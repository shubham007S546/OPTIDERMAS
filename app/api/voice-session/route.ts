import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory token bucket rate limiter per IP: max 12 session requests per 10 minutes
const ipRateLimits = new Map<string, { count: number; resetAt: number }>()

export async function GET(request: NextRequest) {
  // 1. Origin verification
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const host = request.headers.get('host')

  if (origin) {
    try {
      const originHost = new URL(origin).host
      if (host && originHost !== host) {
        return NextResponse.json({ error: 'Forbidden: invalid origin' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Forbidden: invalid origin format' }, { status: 403 })
    }
  } else if (referer) {
    try {
      const refererHost = new URL(referer).host
      if (host && refererHost !== host) {
        return NextResponse.json({ error: 'Forbidden: invalid referer' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Forbidden: invalid referer format' }, { status: 403 })
    }
  }

  // 2. Simple per-IP rate limiting
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'

  const now = Date.now()
  const windowMs = 10 * 60 * 1000 // 10 minutes
  const maxRequests = 12

  const userLimit = ipRateLimits.get(ip)
  if (!userLimit || now > userLimit.resetAt) {
    ipRateLimits.set(ip, { count: 1, resetAt: now + windowMs })
  } else {
    userLimit.count += 1
    if (userLimit.count > maxRequests) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a few minutes before starting a new voice session.' },
        { status: 429 }
      )
    }
  }

  // 3. Server-only credentials check
  const apiKey = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.ELEVENLABS_AGENT_ID

  if (!apiKey || !agentId) {
    return NextResponse.json(
      {
        error:
          'ElevenLabs credentials not configured on server. Please set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID.',
      },
      { status: 503 }
    )
  }

  // 4. Request signed URL from ElevenLabs API
  try {
    const elevenLabsRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
          Accept: 'application/json',
        },
      }
    )

    if (!elevenLabsRes.ok) {
      const errorText = await elevenLabsRes.text().catch(() => '')
      return NextResponse.json(
        {
          error: `ElevenLabs API returned ${elevenLabsRes.status}`,
          detail: errorText,
        },
        { status: 502 }
      )
    }

    const data = await elevenLabsRes.json()
    const signedUrl = data.signed_url || data.signedUrl

    if (!signedUrl) {
      return NextResponse.json(
        { error: 'Failed to retrieve signed URL from ElevenLabs response' },
        { status: 502 }
      )
    }

    return NextResponse.json({ signedUrl }, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: 'Failed to connect to ElevenLabs API', detail: message },
      { status: 500 }
    )
  }
}
