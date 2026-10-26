import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, verifyOrigin } from '@/lib/server-guard'

export async function GET(request: NextRequest) {
  // 1. Origin verification
  const blocked = verifyOrigin(request)
  if (blocked) return blocked

  // 2. Per-IP rate limiting: max 30 session requests per 10 minutes
  const limited = rateLimit(
    request,
    'voice-session',
    30,
    10 * 60 * 1000,
    'Rate limit exceeded. Please wait a few minutes before starting a new voice session.'
  )
  if (limited) return limited

  // 3. Free native speech engine (Zero Quota / Zero Subscription Required)
  const apiKey = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.ELEVENLABS_AGENT_ID

  if (!apiKey || !agentId) {
    return NextResponse.json(
      {
        status: 'ready',
        mode: 'free_native',
        engine: 'Web Speech API & Whisper Audio Turn',
        subscription_required: false,
        message: 'Free native clinical voice assistant active. Zero external API subscription required.',
      },
      { status: 200 }
    )
  }

  // 4. If credentials exist, allow optional signed URL generation
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
          Accept: 'application/json',
        },
      }
    )

    if (!res.ok) {
      return NextResponse.json(
        {
          mode: 'free_native',
          subscription_required: false,
          message: 'External voice subscription inactive. Free native speech fallback active.',
        },
        { status: 200 }
      )
    }

    const data = await res.json()
    return NextResponse.json({ signedUrl: data.signed_url })
  } catch {
    return NextResponse.json(
      {
        mode: 'free_native',
        subscription_required: false,
        message: 'External voice connection unavailable. Free native speech fallback active.',
      },
      { status: 200 }
    )
  }
}
