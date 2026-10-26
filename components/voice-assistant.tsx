'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ConversationProvider, useConversation, useConversationClientTool } from '@elevenlabs/react'
import {
  AlertCircle,
  Clock,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Radio,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { LESION_LABELS, type PredictResponse } from '@/lib/types'
import type { BookingConfirmation } from '@/lib/booking'
import { createBooking, fetchSlots } from '@/lib/booking-client'
import type { BookingPrefill } from './booking-dialog'

export interface VoiceBookingHandlers {
  /** Agent asked to open the booking form (optionally prefilled); the user confirms by clicking. */
  onOpenBooking: (prefill: BookingPrefill) => void
  /** Agent completed a booking directly after the user verbally confirmed the details. */
  onAgentBooked: (booking: BookingConfirmation) => void
}

/** Narrows an untrusted tool argument to a non-empty trimmed string. */
function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function formatAnalysisSummary(result: PredictResponse | null): string {
  if (!result) return 'No lesion analysis yet. Remind the user they can upload and analyze a dermoscopic photo on the Analyse tab.'

  const topPredictions = result.top3
    .map(([cls, prob]) => {
      const label = LESION_LABELS[cls]?.title || cls.toUpperCase()
      return `${label}: ${(prob * 100).toFixed(1)}%`
    })
    .join(', ')

  const measurements = `Area ${result.metrics.area_mm2.toFixed(1)} mm², Perimeter ${result.metrics.perimeter_mm.toFixed(1)} mm, Asymmetry ${result.metrics.asymmetry_index.toFixed(2)}, Compactness ${result.metrics.compactness.toFixed(2)}, Coverage ${result.metrics.coverage_pct.toFixed(1)}%`

  return `Current lesion analysis findings: Risk classification is ${result.risk.level} (${result.risk.recommendation}). Top 3 differential diagnoses: ${topPredictions}. Malignant group probability: ${(result.malignant_prob * 100).toFixed(1)}%. Morphological measurements: ${measurements}. Disclaimer: This is an assistive decision-support model, not a definitive clinical diagnosis. Always recommend consulting a dermatologist.`
}

interface TranscriptEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: string
}

const INACTIVITY_TIMEOUT_MS = 90_000 // 90 seconds of inactivity auto-ends call
const INACTIVITY_WARNING_S = 20

function InnerVoiceAssistant({
  currentResult,
  booking,
}: {
  currentResult: PredictResponse | null
  booking?: VoiceBookingHandlers
}) {
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [micPermissionDenied, setMicPermissionDenied] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [inactivityCountdown, setInactivityCountdown] = useState<number | null>(null)

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActiveResultRef = useRef<PredictResponse | null>(currentResult)
  // Refs avoid stale closures: SDK callbacks fire long after the render that created them
  const sessionActiveRef = useRef(false)
  const endSessionRef = useRef<() => void>(() => {})
  const bookingRef = useRef(booking)
  useEffect(() => {
    bookingRef.current = booking
  }, [booking])

  const clearInactivityTimers = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    inactivityTimerRef.current = null
    countdownIntervalRef.current = null
    setInactivityCountdown(null)
  }, [])

  const resetInactivityTimer = useCallback(() => {
    clearInactivityTimers()
    if (!sessionActiveRef.current) return

    inactivityTimerRef.current = setTimeout(() => {
      let secondsLeft = INACTIVITY_WARNING_S
      setInactivityCountdown(secondsLeft)
      countdownIntervalRef.current = setInterval(() => {
        secondsLeft -= 1
        if (secondsLeft <= 0) {
          clearInactivityTimers()
          endSessionRef.current()
        } else {
          setInactivityCountdown(secondsLeft)
        }
      }, 1000)
    }, INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_S * 1000)
  }, [clearInactivityTimers])

  const conversation = useConversation({
    onConnect: () => {
      sessionActiveRef.current = true
      setSessionError(null)
      resetInactivityTimer()
      if (currentResult) {
        try {
          conversation.sendContextualUpdate(
            `Patient lesion analysis: ${formatAnalysisSummary(currentResult)}`
          )
        } catch {
          // ignore if contextual update isn't ready immediately
        }
      }
    },
    onDisconnect: () => {
      sessionActiveRef.current = false
      clearInactivityTimers()
    },
    onError: (err: unknown) => {
      const message = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Voice session error'
      setSessionError(message)
      sessionActiveRef.current = false
      clearInactivityTimers()
    },
    onMessage: (message: { message: string; source: 'user' | 'ai' }) => {
      resetInactivityTimer()
      setTranscript((prev) => [
        ...prev.slice(-10), // Keep recent short transcript (last 10 items)
        {
          id: Math.random().toString(36).substring(2, 9),
          role: message.source === 'ai' ? 'assistant' : 'user',
          text: message.message,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    },
    onModeChange: () => {
      resetInactivityTimer()
    },
  })

  const { status, isSpeaking, isMuted, setMuted } = conversation
  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'

  useEffect(() => {
    endSessionRef.current = () => conversation.endSession()
  }, [conversation])

  useEffect(() => {
    return () => {
      sessionActiveRef.current = false
      clearInactivityTimers()
    }
  }, [clearInactivityTimers])

  // ---- Booking client tools (names must match the tools configured on the ElevenLabs agent) ----
  // Arguments come from the LLM, so they are treated as untrusted and narrowed at runtime.
  useConversationClientTool('get_available_slots', async (params: Record<string, unknown>) => {
    resetInactivityTimer()
    const date = str(params.date)
    try {
      const { timezone, slots } = await fetchSlots(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined)
      if (slots.length === 0) {
        return date
          ? `No sessions are available on ${date}. Offer to check another day.`
          : 'No sessions are available in the next week.'
      }
      const lines = slots.slice(0, 10).map((s) => `slot_id=${s.id} -> ${s.label}`)
      return `Available sessions (times in ${timezone}):\n${lines.join('\n')}`
    } catch (err) {
      return `Could not load availability: ${err instanceof Error ? err.message : 'unknown error'}`
    }
  })

  useConversationClientTool('open_booking_form', (params: Record<string, unknown>) => {
    resetInactivityTimer()
    if (!bookingRef.current) return 'Booking is not available in this view.'
    bookingRef.current.onOpenBooking({
      slotId: str(params.slot_id),
      name: str(params.name),
      email: str(params.email),
      reason: str(params.reason),
    })
    return "The booking form is now open on the user's screen. Ask them to review the details and press Confirm booking."
  })

  useConversationClientTool('book_session', async (params: Record<string, unknown>) => {
    resetInactivityTimer()
    if (!bookingRef.current) return 'Booking is not available in this view.'
    const slotId = str(params.slot_id)
    const name = str(params.name)
    const email = str(params.email)
    if (!slotId || !name || !email) {
      return 'Booking failed: slot_id, name and email are all required. Ask the user for the missing details.'
    }
    try {
      const confirmation = await createBooking({ slotId, name, email, reason: str(params.reason) })
      bookingRef.current.onAgentBooked(confirmation)
      return `Booked successfully. Reference ${confirmation.reference} for ${confirmation.slot.label} (${confirmation.timezone}). Read the reference number to the user.`
    } catch (err) {
      return `Booking failed: ${err instanceof Error ? err.message : 'unknown error'}. Offer to check availability again.`
    }
  })

  useConversationClientTool('get_analysis_summary', () => {
    resetInactivityTimer()
    return formatAnalysisSummary(currentResult)
  })

  useConversationClientTool('get_current_analysis', () => {
    resetInactivityTimer()
    return formatAnalysisSummary(currentResult)
  })

  useConversationClientTool('get_morphological_metrics', () => {
    resetInactivityTimer()
    if (!currentResult) {
      return 'No morphological metrics available because no image has been analyzed yet.'
    }
    const m = currentResult.metrics
    return `Area: ${m.area_mm2.toFixed(1)} mm², Perimeter: ${m.perimeter_mm.toFixed(1)} mm, Asymmetry Index: ${m.asymmetry_index.toFixed(2)}, Compactness: ${m.compactness.toFixed(2)}, Coverage: ${m.coverage_pct.toFixed(1)}%.`
  })

  // Contextual update if a new analysis completes while in an active call
  useEffect(() => {
    if (
      isConnected &&
      currentResult &&
      currentResult !== lastActiveResultRef.current
    ) {
      lastActiveResultRef.current = currentResult
      const updatedSummary = formatAnalysisSummary(currentResult)
      try {
        conversation.sendContextualUpdate(
          `Update on lesion analysis: ${updatedSummary}`
        )
      } catch {
        // Fallback or ignore if not supported in current state
      }
    }
  }, [currentResult, isConnected, conversation])

  // Request microphone permission and start session
  const handleStartSession = async () => {
    setSessionError(null)
    setMicPermissionDenied(false)

    // Request microphone access first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Release test tracks
      stream.getTracks().forEach((track) => track.stop())
    } catch {
      setMicPermissionDenied(true)
      setSessionError('Microphone access is required for voice consultation. Please allow microphone access in your browser settings and try again.')
      return
    }

    const targetAgentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || 'agent_6601m418gdvxe7zr1zksvnmtb3f1'
    const summaryText = formatAnalysisSummary(currentResult)
    const dynamicVariables = {
      analysis_summary: summaryText,
      analysis: summaryText,
      summary: summaryText,
      findings: summaryText,
      lesion_analysis: summaryText,
    }

    const promptOverride = currentResult
      ? `You are OptiDerma Clinical Voice Consultation Assistant. The patient has uploaded a skin lesion image that was analyzed by the OptiDerma model.
EXACT MODEL ANALYSIS FINDINGS:
${summaryText}
Primary Differential: ${LESION_LABELS[currentResult.top3[0][0]]?.title || currentResult.top3[0][0].toUpperCase()} (${(currentResult.top3[0][1] * 100).toFixed(1)}% confidence).
Assessed Risk Level: ${currentResult.risk.level} (${currentResult.risk.recommendation}).
Malignant group probability: ${(currentResult.malignant_prob * 100).toFixed(1)}%.
Morphology: Area ${currentResult.metrics.area_mm2.toFixed(1)} mm², Asymmetry index ${currentResult.metrics.asymmetry_index.toFixed(2)}, Compactness ${currentResult.metrics.compactness.toFixed(2)}.

INSTRUCTIONS:
1. Greet the patient and explicitly discuss their lesion findings: ${LESION_LABELS[currentResult.top3[0][0]]?.title || currentResult.top3[0][0]}.
2. Calmly explain the differential predictions, asymmetry, and recommended clinical actions.
3. If they ask about appointments or consultations, use the booking tool to help them find slots.
4. Remind them that this is an AI assistive decision-support tool, and recommend consulting a board-certified dermatologist for histopathological diagnosis.`
      : `You are OptiDerma Clinical Voice Consultation Assistant. The patient has not analyzed a skin lesion yet. Explain that they can upload a dermoscopic photo on the Check My Skin tab to receive multi-class predictions, and offer to answer general skin health questions or assist with booking a consultation.`

    const firstMessageOverride = currentResult
      ? `Hello! I have reviewed your OptiDerma lesion analysis for ${LESION_LABELS[currentResult.top3[0][0]]?.title || currentResult.top3[0][0]}. The model evaluated this with a ${currentResult.risk.level} risk level. How can I assist you with these findings?`
      : `Hello! I am OptiDerma's clinical voice assistant. You haven't analyzed a lesion photo yet, but I can answer general skin health questions or help you get started. How can I help today?`

    const sessionConfig = {
      dynamicVariables,
      overrides: {
        agent: {
          prompt: {
            prompt: promptOverride,
          },
          firstMessage: firstMessageOverride,
        },
      },
    }

    try {
      // 1. Attempt fetching signed URL from server API route
      let signedUrl: string | undefined
      try {
        const res = await fetch('/api/voice-session')
        if (res.ok) {
          const data = await res.json()
          if (data.signedUrl) signedUrl = data.signedUrl
        }
      } catch {
        // Fallback to public agentId mode if server API route is unavailable
      }

      // 2. Start ElevenLabs conversation using signedUrl or public agentId with findings injected
      if (signedUrl) {
        await conversation.startSession({
          signedUrl,
          ...sessionConfig,
        })
      } else {
        await conversation.startSession({
          agentId: targetAgentId,
          ...sessionConfig,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setSessionError(`Could not connect to ElevenLabs agent (${targetAgentId}): ${msg}`)
    }
  }

  const handleEndSession = async () => {
    clearInactivityTimers()
    await conversation.endSession()
  }

  return (
    <div className="w-full space-y-6">
      {/* Privacy and Provider Notice */}
      <div className="p-3 rounded-xl border border-border/80 bg-card/60 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Sparkles className="size-3.5 text-primary" />
          ElevenLabs Conversational AI
        </span>
        <span className="text-[11px]">
          Voice audio is processed securely in real-time by ElevenLabs
        </span>
      </div>

      {/* Inactivity warning countdown banner */}
      {inactivityCountdown !== null && (
        <div
          role="status"
          className="flex items-center justify-between p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs"
        >
          <div className="flex items-center gap-2">
            <Clock className="size-4 animate-spin text-amber-600 dark:text-amber-400" />
            <span>Session inactive. Auto-ending in <b>{inactivityCountdown}s</b> due to silence.</span>
          </div>
          <button
            type="button"
            onClick={resetInactivityTimer}
            className="px-2.5 py-1 rounded bg-amber-600 text-white font-semibold text-[11px]"
          >
            Stay Connected
          </button>
        </div>
      )}

      {/* Error Banner */}
      {sessionError && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300 text-xs space-y-1"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="size-4 text-red-600 dark:text-red-400" />
            <span>Connection Notice</span>
          </div>
          <p className="opacity-90">{sessionError}</p>
          {micPermissionDenied && (
            <p className="text-[11px] pt-1 opacity-80">
              Please check your browser settings and grant microphone access to use voice consultation.
            </p>
          )}
        </div>
      )}

      {/* Main Interactive Voice Card */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-xs flex flex-col items-center text-center space-y-5">
        {/* Status Orb Indicator */}
        <div className="relative">
          <div
            className={`size-24 rounded-full flex items-center justify-center transition-all duration-300 ${
              isConnected
                ? isSpeaking
                  ? 'bg-primary/20 text-primary ring-8 ring-primary/20 scale-105'
                  : 'bg-emerald-500/20 text-emerald-600 ring-4 ring-emerald-500/20'
                : isConnecting
                ? 'bg-amber-500/20 text-amber-600 animate-pulse'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {isConnected ? (
              isSpeaking ? (
                <Radio className="size-10 animate-pulse" />
              ) : (
                <Mic className="size-10" />
              )
            ) : isConnecting ? (
              <Radio className="size-10 animate-spin" />
            ) : (
              <MicOff className="size-10" />
            )}
          </div>

          {isConnected && (
            <span
              className={`absolute bottom-0 right-0 size-5 rounded-full border-2 border-background ${
                isSpeaking ? 'bg-primary' : 'bg-emerald-500'
              }`}
            />
          )}
        </div>

        {/* State Label */}
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">
            {isConnected
              ? isSpeaking
                ? 'OptiDerma is speaking…'
                : isMuted
                ? 'Microphone muted'
                : 'Listening to your question…'
              : isConnecting
              ? 'Connecting to ElevenLabs agent…'
              : 'OptiDerma Voice Assistant'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {isConnected
              ? currentResult
                ? 'Discussing your uploaded lesion analysis and morphological metrics.'
                : 'Ask general questions about skin health and dermoscopy analysis.'
              : 'Start a voice consultation to ask questions about skin lesion characteristics and results.'}
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {!isConnected ? (
            <button
              type="button"
              onClick={handleStartSession}
              disabled={isConnecting}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold text-xs shadow-xs hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <PhoneCall className="size-4" />
              {isConnecting ? 'Starting Session…' : 'Start Voice Consultation'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMuted(!isMuted)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs font-semibold transition-colors ${
                  isMuted
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'border-border bg-card hover:bg-muted text-foreground'
                }`}
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button
                type="button"
                onClick={handleEndSession}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                <PhoneOff className="size-3.5" />
                End Consultation
              </button>
            </>
          )}
        </div>
      </div>

      {/* Live Short Transcript */}
      {transcript.length > 0 && (
        <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Conversation Transcript
            </span>
            <span className="text-[10px] text-muted-foreground">In-memory session log</span>
          </div>

          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {transcript.map((entry) => (
              <div
                key={entry.id}
                className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                  entry.role === 'assistant'
                    ? 'bg-primary/10 text-foreground border border-primary/20 mr-6'
                    : 'bg-muted/70 text-foreground ml-6'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 font-semibold">
                  <span>{entry.role === 'assistant' ? 'OptiDerma' : 'You'}</span>
                  <span>{entry.timestamp}</span>
                </div>
                <p>{entry.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function VoiceAssistant({
  currentResult,
  booking,
}: {
  currentResult: PredictResponse | null
  booking?: VoiceBookingHandlers
}) {
  return (
    <ConversationProvider>
      <InnerVoiceAssistant currentResult={currentResult} booking={booking} />
    </ConversationProvider>
  )
}
