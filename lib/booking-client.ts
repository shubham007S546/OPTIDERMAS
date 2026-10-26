import {
  SlotsResponseSchema,
  type BookingConfirmation,
  type BookingRequest,
  type BookingSlot,
} from './booking'

export class BookingError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'BookingError'
    this.status = status
  }
}

async function readError(res: Response): Promise<string> {
  const json = await res.json().catch(() => null)
  return (json && typeof json.error === 'string' && json.error) || `Request failed (HTTP ${res.status})`
}

export async function fetchSlots(
  date?: string,
  signal?: AbortSignal
): Promise<{ timezone: string; slots: BookingSlot[] }> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ''
  let res: Response
  try {
    res = await fetch(`/api/bookings${qs}`, { cache: 'no-store', signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new BookingError('Could not reach the booking service. Please check your connection.', 0)
  }
  if (!res.ok) throw new BookingError(await readError(res), res.status)
  const parsed = SlotsResponseSchema.safeParse(await res.json())
  if (!parsed.success) throw new BookingError('Unexpected response from the booking service.', 502)
  return parsed.data
}

export async function createBooking(req: BookingRequest): Promise<BookingConfirmation> {
  let res: Response
  try {
    res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
  } catch {
    throw new BookingError('Could not reach the booking service. Please check your connection.', 0)
  }
  if (!res.ok) throw new BookingError(await readError(res), res.status)
  return (await res.json()) as BookingConfirmation
}
