import { NextRequest, NextResponse } from 'next/server'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Map<string, Bucket>>()

/** Same-host Origin/Referer check. Returns an error response, or null when the request is allowed. */
export function verifyOrigin(request: NextRequest): NextResponse | null {
  const host = request.headers.get('host')
  const source = request.headers.get('origin') ?? request.headers.get('referer')
  if (!source) return null
  try {
    if (host && new URL(source).host !== host) {
      return NextResponse.json({ error: 'Forbidden: invalid origin' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Forbidden: invalid origin format' }, { status: 403 })
  }
  return null
}

/** Fixed-window per-IP rate limit. Returns a 429 response when exceeded, otherwise null. */
export function rateLimit(
  request: NextRequest,
  scope: string,
  max: number,
  windowMs: number,
  message: string
): NextResponse | null {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  const now = Date.now()

  let scoped = buckets.get(scope)
  if (!scoped) {
    scoped = new Map()
    buckets.set(scope, scoped)
  }
  // Prune expired entries so the map cannot grow without bound
  if (scoped.size > 500) {
    for (const [key, b] of scoped) if (now > b.resetAt) scoped.delete(key)
  }

  const bucket = scoped.get(ip)
  if (!bucket || now > bucket.resetAt) {
    scoped.set(ip, { count: 1, resetAt: now + windowMs })
    return null
  }
  bucket.count += 1
  if (bucket.count > max) {
    return NextResponse.json({ error: message }, { status: 429 })
  }
  return null
}
