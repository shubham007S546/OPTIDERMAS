import { z } from 'zod'

/** Clinic-local scheduling constants (override on the server via env). */
export const CLINIC_TIMEZONE = 'Asia/Kolkata'
export const CLINIC_UTC_OFFSET_MINUTES = 330 // IST (+05:30); must match CLINIC_TIMEZONE
export const SLOT_HOURS = [9, 10, 11, 14, 15, 16] as const // clinic-local start hours
export const BOOKING_HORIZON_DAYS = 7
export const MIN_LEAD_TIME_MS = 2 * 60 * 60 * 1000 // slots must start at least 2h from now

export interface BookingSlot {
  /** ISO-8601 UTC start instant; also the unique slot identifier */
  id: string
  /** Clinic-local calendar date, YYYY-MM-DD */
  date: string
  /** Human readable label in clinic timezone, e.g. "Mon 5 Oct, 10:00 AM" */
  label: string
}

export const BookingRequestSchema = z.object({
  slotId: z.string().min(1).max(40),
  name: z.string().trim().min(2, 'Please enter your full name').max(80),
  email: z.string().trim().max(120).pipe(z.email('Please enter a valid email address')),
  reason: z.string().trim().max(300).optional(),
})
export type BookingRequest = z.infer<typeof BookingRequestSchema>

export interface BookingConfirmation {
  reference: string
  slot: BookingSlot
  name: string
  email: string
  timezone: string
}

export const SlotsResponseSchema = z.object({
  timezone: z.string(),
  slots: z.array(z.object({ id: z.string(), date: z.string(), label: z.string() })),
})

const labelFormatter = (tz: string) =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

const dateFormatter = (tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })

export function describeSlot(id: string, tz = CLINIC_TIMEZONE): BookingSlot | null {
  const d = new Date(id)
  if (Number.isNaN(d.getTime())) return null
  return { id: d.toISOString(), date: dateFormatter(tz).format(d), label: labelFormatter(tz).format(d) }
}

/** Generates every bookable slot for the next BOOKING_HORIZON_DAYS clinic days (Mon–Fri). */
export function generateSlots(now = new Date(), offsetMin = CLINIC_UTC_OFFSET_MINUTES): BookingSlot[] {
  const slots: BookingSlot[] = []
  // Clinic-local "today" at midnight, expressed as a UTC instant
  const localNow = new Date(now.getTime() + offsetMin * 60_000)
  const localMidnightUtc = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate())

  for (let day = 0; day <= BOOKING_HORIZON_DAYS; day++) {
    const dayStartLocal = localMidnightUtc + day * 86_400_000
    const weekday = new Date(dayStartLocal).getUTCDay() // 0 Sun … 6 Sat (clinic-local calendar day)
    if (weekday === 0 || weekday === 6) continue
    for (const hour of SLOT_HOURS) {
      const startUtcMs = dayStartLocal + hour * 3_600_000 - offsetMin * 60_000
      if (startUtcMs - now.getTime() < MIN_LEAD_TIME_MS) continue
      const slot = describeSlot(new Date(startUtcMs).toISOString())
      if (slot) slots.push(slot)
    }
  }
  return slots
}
