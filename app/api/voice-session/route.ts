import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, verifyOrigin } from '@/lib/server-guard'

export async function GET(request: NextRequest) {
  // 1. Origin verification
  const blocked = verifyOrigin(request)
  if (blocked) return blocked

  // 2. Simple per-IP rate limiting: max 12 session requests per 10 minutes
  const limited = rateLimit(
    request,
    'voice-session',
    12,
    10 * 60 * 1000,
    'Rate limit exceeded. Please wait a few minutes before starting a new voice session.'
  )
  if (limited) return limited

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
