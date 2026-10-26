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

  // 3. Credentials check: support both private signed URL mode and public agent mode
  const apiKey = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.ELEVENLABS_AGENT_ID || process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || 'agent_6601m418gdvxe7zr1zksvnmtb3f1'

  // If no private server API key is configured, return the public agent configuration
  // so the client can connect directly via WebRTC using official @elevenlabs/react public mode.
  if (!apiKey) {
    if (!agentId) {
      return NextResponse.json(
        {
          error:
            'ElevenLabs agent ID not configured. Please set NEXT_PUBLIC_ELEVENLABS_AGENT_ID or ELEVENLABS_AGENT_ID.',
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        mode: 'public',
        agentId,
        message: 'Public browser agent mode active. Direct WebRTC connection supported without server API key.',
      },
      { status: 200 }
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
      const isQuota = elevenLabsRes.status === 401 || elevenLabsRes.status === 402 || elevenLabsRes.status === 429
      return NextResponse.json(
        {
          error: isQuota ? 'ElevenLabs voice quota exceeded or credits finished' : `ElevenLabs API returned ${elevenLabsRes.status}`,
          detail: errorText,
          quotaExceeded: isQuota,
        },
        { status: isQuota ? 402 : 502 }
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
