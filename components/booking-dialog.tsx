'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CalendarCheck, CalendarDays, CheckCircle2, Loader2, X } from 'lucide-react'
import type { BookingConfirmation, BookingSlot } from '@/lib/booking'
import { BookingError, createBooking, fetchSlots } from '@/lib/booking-client'

export interface BookingPrefill {
  slotId?: string
  name?: string
  email?: string
  reason?: string
}

interface BookingDialogProps {
  open: boolean
  prefill?: BookingPrefill
  /** Confirmation made elsewhere (e.g. by the voice agent) to show immediately */
  confirmation?: BookingConfirmation | null
  onClose: () => void
  onBooked: (booking: BookingConfirmation) => void
}

function dayHeading(date: string): string {
  // Noon UTC avoids any date rollover when formatting a plain calendar date
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T12:00:00Z`))
}

function timeOnly(label: string): string {
  const idx = label.lastIndexOf(',')
  return idx >= 0 ? label.slice(idx + 1).trim() : label
}

export function BookingDialog({ open, prefill, confirmation, onClose, onBooked }: BookingDialogProps) {
  const [slots, setSlots] = useState<BookingSlot[]>([])
  const [timezone, setTimezone] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slotId, setSlotId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState<BookingConfirmation | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const loadSlots = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await fetchSlots(undefined, signal)
      setSlots(data.slots)
      setTimezone(data.timezone)
      return data.slots
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return []
      setLoadError(err instanceof BookingError ? err.message : 'Could not load available times.')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Reset and load each time the dialog opens
  useEffect(() => {
    if (!open) return
    setDone(confirmation ?? null)
    setSubmitError(null)
    setName(prefill?.name ?? '')
    setEmail(prefill?.email ?? '')
    setReason(prefill?.reason ?? '')
    setSlotId(prefill?.slotId ?? null)
    setSelectedDate(null)

    const controller = new AbortController()
    loadSlots(controller.signal).then((loaded) => {
      const pre = loaded.find((s) => s.id === prefill?.slotId)
      setSelectedDate(pre?.date ?? loaded[0]?.date ?? null)
      if (prefill?.slotId && !pre) setSlotId(null)
    })
    return () => controller.abort()
  }, [open, prefill, confirmation, loadSlots])

  // Keyboard: Escape closes; focus the close button once on open
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const dates = useMemo(() => Array.from(new Set(slots.map((s) => s.date))), [slots])
  const daySlots = useMemo(() => slots.filter((s) => s.date === selectedDate), [slots, selectedDate])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!slotId || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const booking = await createBooking({ slotId, name, email, reason: reason || undefined })
      setDone(booking)
      onBooked(booking)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Booking failed. Please try again.')
      if (err instanceof BookingError && err.status === 409) {
        setSlotId(null)
        await loadSlots() // refresh so the taken slot disappears
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-[#cbdbe8] dark:border-[#1c4756] bg-[#ffffff] dark:bg-[#071923] text-[#12315a] dark:text-[#e8f7fa] shadow-2xl p-0"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border/80 bg-muted/20">
          <div>
            <h2 id="booking-title" className="text-lg font-bold flex items-center gap-2 text-foreground">
              <CalendarDays className="size-5 text-primary" />
              Book a session
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Tele-consultation with a dermatology professional. This does not replace emergency care.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close booking dialog"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {done ? (
          <div className="p-6 text-center space-y-4" role="status">
            <CheckCircle2 className="size-12 mx-auto text-emerald-500" />
            <div>
              <h3 className="text-base font-bold text-foreground">Session booked</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {done.slot.label} ({done.timezone})
              </p>
            </div>
            <div className="inline-block px-4 py-2 rounded-xl bg-muted/60 border border-border font-mono text-sm font-bold tracking-wider text-foreground">
              {done.reference}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Booked for <b>{done.name}</b> ({done.email}). Keep this reference number — you will need it to
              reschedule. Demo environment: no confirmation email is sent.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-5" noValidate>
            {loadError && (
              <div role="alert" className="flex items-start gap-2 p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-800 dark:text-red-300">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p>{loadError}</p>
                  <button type="button" onClick={() => loadSlots()} className="underline font-semibold">
                    Try again
                  </button>
                </div>
              </div>
            )}

            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Choose a day {timezone && <span className="normal-case font-medium">· times in {timezone}</span>}
              </legend>
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                  <Loader2 className="size-4 animate-spin text-primary" /> Loading available times…
                </div>
              ) : dates.length === 0 && !loadError ? (
                <p className="text-xs text-muted-foreground py-2">No times are available right now.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {dates.map((d) => (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={selectedDate === d}
                        onClick={() => setSelectedDate(d)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                          selectedDate === d
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border bg-card text-foreground hover:bg-muted'
                        }`}
                      >
                        {dayHeading(d)}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1" role="group" aria-label="Available times">
                    {daySlots.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={slotId === s.id}
                        onClick={() => setSlotId(s.id)}
                        className={`px-2 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                          slotId === s.id
                            ? 'bg-primary/20 border-primary text-primary ring-2 ring-primary/30'
                            : 'border-border bg-card text-foreground hover:bg-muted'
                        }`}
                      >
                        {timeOnly(s.label)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                2. Your details
              </legend>
              <label className="block text-xs font-semibold text-foreground">
                Full name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  maxLength={80}
                  required
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-normal focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </label>
              <label className="block text-xs font-semibold text-foreground">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  maxLength={120}
                  required
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-normal focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </label>
              <label className="block text-xs font-semibold text-foreground">
                Reason for visit <span className="font-normal text-muted-foreground">(optional)</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={300}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-normal resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <span className="text-[10px] font-normal text-muted-foreground">
                  Do not include images or sensitive identifiers. {reason.length}/300
                </span>
              </label>
            </fieldset>

            {submitError && (
              <div role="alert" className="flex items-start gap-2 p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-800 dark:text-red-300">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!slotId || !name.trim() || !email.trim() || submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-45 disabled:cursor-not-allowed shadow-md"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
              {submitting ? 'Booking…' : 'Confirm booking'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
