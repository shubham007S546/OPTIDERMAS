import { NextRequest, NextResponse } from 'next/server'
import {
  BookingRequestSchema,
  CLINIC_TIMEZONE,
  describeSlot,
  generateSlots,
  type BookingConfirmation,
} from '@/lib/booking'
import { rateLimit, verifyOrigin } from '@/lib/server-guard'
import { supabase } from '@/lib/supabase'
/**
 * Global store for fallback when database table is connecting/initializing.
 */
const globalStore = globalThis as unknown as { __optidermaBookings?: Map<string, BookingConfirmation> }
const store = (globalStore.__optidermaBookings ??= new Map<string, BookingConfirmation>())
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  const blocked = verifyOrigin(request)
  if (blocked) return blocked
  const date = request.nextUrl.searchParams.get('date')
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date must be formatted YYYY-MM-DD' }, { status: 400 })
  }
  // Attempt reading booked slot_ids from Supabase
  const bookedSlotIds = new Set<string>(store.keys())
  try {
    const { data, error } = await supabase.from('bookings').select('slot_id')
    if (!error && data) {
      data.forEach((row: { slot_id: string }) => bookedSlotIds.add(row.slot_id))
    }
  } catch {
    // Graceful fallback to memory store
  }
  const slots = generateSlots().filter((s) => !bookedSlotIds.has(s.id) && (!date || s.date === date))
  return NextResponse.json({ timezone: CLINIC_TIMEZONE, slots })
}
export async function POST(request: NextRequest) {
  const blocked = verifyOrigin(request)
  if (blocked) return blocked

  const limited = rateLimit(
    request,
    'bookings',
    10,
    10 * 60 * 1000,
    'Too many booking attempts. Please wait a few minutes and try again.'
  )
  if (limited) return limited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const parsed = BookingRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid booking request' },
      { status: 400 }
    )
  }

  const { slotId, name, email, reason } = parsed.data
  const slot = generateSlots().find((s) => s.id === new Date(slotId).toISOString())
  if (!slot) {
    return NextResponse.json(
      { error: 'That time is no longer available. Please choose another slot.' },
      { status: 409 }
    )
  }

  // Check Supabase database for existing booking
  try {
    const { data: existing } = await supabase
      .from('bookings')
      .select('slot_id')
      .eq('slot_id', slot.id)
      .maybeSingle()

    if (existing || store.has(slot.id)) {
      return NextResponse.json(
        { error: 'Sorry, that slot was just taken. Please choose another time.' },
        { status: 409 }
      )
    }
  } catch {
    if (store.has(slot.id)) {
      return NextResponse.json(
        { error: 'Sorry, that slot was just taken. Please choose another time.' },
        { status: 409 }
      )
    }
  }

  const reference = `OD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const targetSlot = describeSlot(slot.id) ?? slot

  const confirmation: BookingConfirmation = {
    reference,
    slot: targetSlot,
    name,
    email,
    timezone: CLINIC_TIMEZONE,
  }

  // Persist to Supabase database table `bookings`
  try {
    await supabase.from('bookings').insert({
      reference,
      slot_id: targetSlot.id,
      slot_date: targetSlot.date,
      slot_label: targetSlot.label,
      name,
      email,
      reason: reason || '',
      status: 'confirmed',
    })
  } catch (dbErr) {
    console.warn('Supabase insertion warning (stored in memory fallback):', dbErr)
  }

  store.set(slot.id, confirmation)
  return NextResponse.json(confirmation, { status: 201 })
}

