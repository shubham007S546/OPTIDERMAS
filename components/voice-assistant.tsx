'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ConversationProvider, useConversation, useConversationClientTool } from '@elevenlabs/react'
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Play,
  Radio,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  User,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react'
import { LESION_LABELS, type PredictResponse } from '@/lib/types'
import type { BookingConfirmation } from '@/lib/booking'
import { createBooking, fetchSlots } from '@/lib/booking-client'
import { submitVoiceTurn } from '@/lib/api'
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

  if (result.patient_summary) {
    const ps = result.patient_summary
    const actionPlan = ps.action_plan?.length ? `Recommended next steps: ${ps.action_plan.slice(0, 3).join('. ')}.` : ''
    return `Here is your skin analysis summary. ${ps.headline}. The AI noticed visual characteristics resembling a ${ps.condition_plain_name}, with a ${ps.concern_level} concern level. ${ps.simple_explanation} ${actionPlan} Please note that this is an AI decision-support research assistant, not a definitive clinical diagnosis. Always consult a qualified dermatologist for direct examination.`
  }

  const topPredictions = result.top3
    .map(([cls, prob]) => {
      const label = LESION_LABELS[cls]?.title || cls.toUpperCase()
      return `${label}: ${(prob * 100).toFixed(1)}%`
    })
    .join(', ')

  const pixelArea = result.metrics.area_px ? `${result.metrics.area_px.toLocaleString()} pixels` : 'unrecorded'
  const indicativeMm2 = `${result.metrics.area_mm2.toFixed(1)} mm² (uncalibrated nominal estimate)`
  const measurements = `Area: ${pixelArea} [${indicativeMm2}], Perimeter: ${result.metrics.perimeter_px || result.metrics.perimeter_mm.toFixed(1)} px, Asymmetry: ${result.metrics.asymmetry_index.toFixed(2)}, Compactness: ${result.metrics.compactness.toFixed(2)}, Coverage: ${result.metrics.coverage_pct.toFixed(1)}%`
  const analysisId = result.analysis_id ? ` Analysis Record UUID: ${result.analysis_id}.` : ''
  const verifStatus = result.verification ? ` Independent Verification: ${result.verification.passed ? 'PASSED' : 'REQUIRES CLINICAL REVIEW'}.` : ''
  const hairInfo = result.hair_removal?.hair_detected ? ` DullRazor detected and cleaned ${result.hair_removal.detected_strands || 0} hair strands.` : ''
  const calibNote = ' Calibration notice: Physical measurements in mm are uncalibrated nominal estimates; no optical reticle was detected.'

  return `Current lesion analysis findings:${analysisId} Risk classification is ${result.risk.level} (${result.risk.recommendation}). Top 3 differential diagnoses: ${topPredictions}. Malignant group probability: ${(result.malignant_prob * 100).toFixed(1)}%. Morphological measurements: ${measurements}.${hairInfo}${verifStatus}${calibNote} Disclaimer: This is an assistive decision-support research model, not a clinical diagnosis. Always recommend consulting a qualified dermatologist.`
}

/** Cleans clinical text for clear, natural speech synthesis by removing Markdown and citations. */
export function cleanSpeechText(text: string): string {
  if (!text) return ''
  return text
    .replace(/\[CIT-[^\]]+\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/#+\s*/g, '')
    .replace(/[*_]{1,3}/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*[-•]\s*/gm, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Local clinical reasoner safety net in case backend or cloud is unreachable. */
export function generateLocalClinicalResponse(query: string, result: PredictResponse | null): string {
  const q = query.toLowerCase()
  if (!result) {
    if (q.includes('book') || q.includes('appointment') || q.includes('consult') || q.includes('doctor')) {
      return 'I can connect you with a verified dermatologist. Please click Care Connect in the navigation or use the booking button to select an available appointment slot.'
    }
    if (q.includes('melanoma') || q.includes('skin cancer')) {
      return 'Melanoma is the most critical form of skin cancer, arising from melanocytes. The ABCDE criteria guide evaluation: Asymmetry, Border irregularity, Color variegation, Diameter over 6mm, and Evolution over time. For concerns, consult a dermatologist promptly.'
    }
    if (q.includes('eczema') || q.includes('psoriasis')) {
      return 'Eczema typically presents as pruritic, ill-defined erythematous patches with scaling on flexural skin. Psoriasis presents with sharply demarcated plaques covered by silvery-white micaceous scale on extensor surfaces like elbows and knees.'
    }
    return 'OptiDerma is your clinical decision-support assistant. Please upload a dermoscopic photograph on the Analyse tab for AI multi-task classification, morphological measurements, and Grad-CAM explainability, or ask any general dermatology question.'
  }

  const top = result.top3[0]
  const topLabel = LESION_LABELS[top[0]]?.title || top[0].toUpperCase()
  const topProb = (top[1] * 100).toFixed(1)
  const risk = result.risk.level
  const rec = result.risk.recommendation

  if (q.includes('book') || q.includes('appointment') || q.includes('doctor') || q.includes('consult')) {
    return `Given the ${risk} risk classification for suspected ${topLabel}, I recommend booking a formal consultation with a specialist. I have opened the appointment booking form on your screen.`
  }

  if (q.includes('risk') || q.includes('malignan') || q.includes('cancer') || q.includes('melanoma')) {
    const malProb = (result.malignant_prob * 100).toFixed(1)
    return `Your lesion is classified as ${risk} risk with a malignant group probability of ${malProb}%. The primary differential prediction is ${topLabel} at ${topProb}%. Recommendation: ${rec}. Note: This AI analysis is an assistive screening tool, not a histological biopsy.`
  }

  if (q.includes('metric') || q.includes('measurement') || q.includes('area') || q.includes('asymmetry') || q.includes('compact')) {
    const m = result.metrics
    return `Lesion morphometrics: Area is measured at ${m.area_px || 'unrecorded'} pixels with an uncalibrated nominal estimate of ${m.area_mm2.toFixed(1)} square millimeters. Asymmetry index is ${m.asymmetry_index.toFixed(2)}, compactness is ${m.compactness.toFixed(2)}, and perimeter is ${m.perimeter_px || m.perimeter_mm.toFixed(1)} pixels.`
  }

  if (q.includes('grad') || q.includes('cam') || q.includes('heat') || q.includes('highlight') || q.includes('focus')) {
    return `The Grad-CAM heatmap highlights deep convolutional activations for ${topLabel}. Warmer red and yellow regions show morphological features that most strongly guided the model's classification, while the green contour displays the segmentation boundary.`
  }

  if (q.includes('differen') || q.includes('ranking') || q.includes('top') || q.includes('diagnos') || q.includes('explain')) {
    const top3Str = result.top3.map(([c, p]) => `${LESION_LABELS[c]?.title || c.toUpperCase()} at ${(p * 100).toFixed(1)}%`).join(', ')
    return `Active lesion differential diagnosis: ${top3Str}. Risk rating is ${risk}. ${rec} Consult a qualified dermatologist for definitive clinical evaluation.`
  }

  return `Based on your analyzed lesion image: The primary prediction is ${topLabel} (${topProb}%) with an overall ${risk} risk rating. Recommendation: ${rec}. You can ask about differential ranking, morphological metrics, Grad-CAM heatmap, or schedule a dermatologist appointment.`
}

interface TranscriptEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: string
  audioBase64?: string
  provider?: string
}

const INACTIVITY_TIMEOUT_MS = 90_000 // 90 seconds of inactivity auto-ends call
const INACTIVITY_WARNING_S = 20

// =============================================================================
// 1. ELEVENLABS REALTIME WEBRTC ASSISTANT
// =============================================================================

function InnerVoiceAssistant({
  currentResult,
  booking,
  onSwitchToFallback,
}: {
  currentResult: PredictResponse | null
  booking?: VoiceBookingHandlers
  onSwitchToFallback?: (reason?: string) => void
}) {
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [isQuotaExhausted, setIsQuotaExhausted] = useState(false)
  const [micPermissionDenied, setMicPermissionDenied] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [inactivityCountdown, setInactivityCountdown] = useState<number | null>(null)

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActiveResultRef = useRef<PredictResponse | null>(currentResult)
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

  const checkQuotaError = (msg: string): boolean => {
    return /quota|credit|limit|exceeded|402|429|server error|unknown error|disabled|subscription|unauthorized|failed to connect/i.test(msg)
  }

  const conversation = useConversation({
    onConnect: () => {
      sessionActiveRef.current = true
      setSessionError(null)
      setIsQuotaExhausted(false)
      resetInactivityTimer()
      const summary = formatAnalysisSummary(currentResult)
      try {
        conversation.sendContextualUpdate(
          `Patient lesion analysis: ${summary}`
        )
      } catch {
        // ignore if contextual update isn't ready immediately
      }

      // Automatically trigger greeting and segment-by-segment explanation upon connection
      setTimeout(() => {
        try {
          if (currentResult) {
            conversation.sendUserMessage(
              'Please greet me and explain my active skin lesion analysis findings in complete segment-wise clinical detail.'
            )
          } else {
            conversation.sendUserMessage(
              'Hello! Please greet me and explain how you assist with skin lesion evaluation.'
            )
          }
        } catch (err) {
          console.warn('Auto-voice start message notice:', err)
        }
      }, 500)
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
      if (checkQuotaError(message)) {
        setIsQuotaExhausted(true)
      }
      onSwitchToFallback?.(message)
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
      if (sessionActiveRef.current) {
        try {
          endSessionRef.current()
        } catch {
          // ignore cleanup errors on unmount
        }
      }
      sessionActiveRef.current = false
      clearInactivityTimers()
    }
  }, [clearInactivityTimers])

  // ---- Client Tools Grounding (Called dynamically by the ElevenLabs LLM) ----

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
    const px = m.area_px ? `${m.area_px} pixels` : 'N/A'
    return `Measured Area: ${px} (nominal uncalibrated estimate: ${m.area_mm2.toFixed(1)} mm²), Perimeter: ${m.perimeter_px || m.perimeter_mm.toFixed(1)} px, Asymmetry Index: ${m.asymmetry_index.toFixed(2)}, Compactness: ${m.compactness.toFixed(2)}, Coverage: ${m.coverage_pct.toFixed(1)}%. Note: No physical optical reticle was detected.`
  })

  useConversationClientTool('get_calibrated_measurements', () => {
    resetInactivityTimer()
    if (!currentResult) return 'No image has been analyzed yet.'
    return `Physical calibration status: UNCALIBRATED. Area is measured natively as ${currentResult.metrics.area_px || 'N/A'} pixels. Metric mm² values assume an uncalibrated 15mm dermoscopic contact plate and should be treated as indicative only.`
  })

  useConversationClientTool('get_highlighted_area_explanation', () => {
    resetInactivityTimer()
    if (!currentResult) {
      return 'No lesion image has been analyzed yet.'
    }
    const targetClass = currentResult.cam_target_class || currentResult.top3[0][0]
    const label = LESION_LABELS[targetClass]?.title || targetClass.toUpperCase()
    return `The Grad-CAM highlighted heatmap shows the deep convolutional activation focus for ${label}. Warmer red/yellow regions indicate the patterns most influential in the model's decision, while the green contour shows the U-Net boundary segmentation. This is an explanatory aid, not a histological confirmation.`
  })

  useConversationClientTool('get_model_limitations', () => {
    resetInactivityTimer()
    return 'OptiDerma is an investigational research prototype for dermoscopic decision support, not an FDA-cleared diagnostic device. It is trained on dermoscopic photographs and cannot replace biopsy or clinical examination by a board-certified dermatologist.'
  })

  useConversationClientTool('get_verification_status', () => {
    resetInactivityTimer()
    if (!currentResult || !currentResult.verification) {
      return 'No formal verification audit has been run on this session yet.'
    }
    const v = currentResult.verification
    return `Independent verification audit status: ${v.passed ? 'PASSED' : 'REQUIRES CLINICAL REVIEW'}. Warnings: ${v.warnings && v.warnings.length > 0 ? v.warnings.join('; ') : 'None'}. Analysis ID: ${currentResult.analysis_id || 'unassigned'}.`
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
    if (isConnecting || isConnected) return

    setSessionError(null)
    setIsQuotaExhausted(false)
    setMicPermissionDenied(false)

    const targetAgentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || 'agent_6601m418gdvxe7zr1zksvnmtb3f1'
    if (!targetAgentId) {
      setSessionError('Voice Assistant Unavailable: No ElevenLabs agent ID is configured.')
      return
    }

    // Request microphone access first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
    } catch {
      setMicPermissionDenied(true)
      setSessionError('Microphone access is required for voice consultation. Please allow microphone access in your browser settings and try again.')
      return
    }

    const summaryText = formatAnalysisSummary(currentResult)

    try {
      let signedUrl: string | undefined
      try {
        const res = await fetch('/api/voice-session')
        if (res.ok) {
          const data = await res.json()
          if (data.signedUrl) signedUrl = data.signedUrl
        } else if (res.status === 402 || res.status === 429) {
          setIsQuotaExhausted(true)
        }
      } catch {
        // Fallback directly to public agentId mode
      }

      if (signedUrl) {
        await conversation.startSession({
          signedUrl,
          overrides: {
            agent: {
              prompt: {
                prompt: `You are OptiDerma Clinical Voice Consultation Assistant. Lesion findings:\n${summaryText}`,
              },
            },
          },
        })
      } else {
        await conversation.startSession({
          agentId: targetAgentId,
          connectionType: 'webrtc',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setSessionError(`Could not connect to ElevenLabs agent (${targetAgentId}): ${msg}`)
      if (checkQuotaError(msg)) {
        setIsQuotaExhausted(true)
      }
    }
  }

  const handleEndSession = async () => {
    clearInactivityTimers()
    await conversation.endSession()
  }

  // Derive granular connection state
  let connectionStateLabel = 'Disconnected'
  if (isConnecting) connectionStateLabel = 'Connecting…'
  else if (isConnected) {
    if (isSpeaking) connectionStateLabel = 'Speaking'
    else if (isMuted) connectionStateLabel = 'Muted'
    else connectionStateLabel = 'Connected'
  } else if (sessionError) {
    connectionStateLabel = isQuotaExhausted ? 'Quota Finished' : sessionError.includes('Unavailable') ? 'Unavailable' : 'Error'
  }

  return (
    <div className="w-full space-y-5">
      {/* Provider Notice */}
      <div className="p-3 rounded-xl border border-sky-200/80 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/20 flex items-center justify-between text-xs text-sky-900 dark:text-sky-300">
        <span className="flex items-center gap-1.5 font-semibold">
          <Sparkles className="size-3.5 text-sky-600 dark:text-sky-400" />
          ElevenLabs WebRTC Voice Engine
        </span>
        <span className="text-[11px] opacity-80">
          Cloud WebRTC Streaming · Grounded Analysis
        </span>
      </div>

      {/* Quota Exhaustion Alert & Instant Switch */}
      {isQuotaExhausted && (
        <div
          role="alert"
          className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-200 text-xs space-y-3"
        >
          <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            <span>ElevenLabs Voice Quota Exhausted</span>
          </div>
          <p className="opacity-90 leading-relaxed text-[11px]">
            Your ElevenLabs agent usage quota or credits have finished. We&apos;ve provided a built-in Free Spoken Voice Fallback with unlimited access, local speech recognition, and speech synthesis (gTTS / Web Speech) that works right away.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onSwitchToFallback?.('ElevenLabs voice quota exhausted')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <Zap className="size-3.5" />
              Switch to Free Voice Fallback Now
            </button>
          </div>
        </div>
      )}

      {/* Inactivity countdown banner */}
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

      {/* Error Banner with Actionable Advice */}
      {sessionError && !isQuotaExhausted && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300 text-xs space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="size-4 text-red-600 dark:text-red-400" />
              <span>Connection Diagnostics</span>
            </div>
            {onSwitchToFallback && (
              <button
                type="button"
                onClick={() => onSwitchToFallback(sessionError)}
                className="text-[11px] underline font-semibold text-red-700 dark:text-red-300 hover:text-red-900"
              >
                Use Fallback Voice Instead →
              </button>
            )}
          </div>
          <p className="opacity-90 leading-relaxed text-[11px]">{sessionError}</p>
          {micPermissionDenied && (
            <p className="text-[11px] font-medium pt-1 text-red-700 dark:text-red-200">
              *Microphone access was denied. Check your browser site permissions to allow audio recording.
            </p>
          )}
        </div>
      )}

      {/* Main Interactive Voice Card */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-xs flex flex-col items-center text-center space-y-5">
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
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-base font-bold text-foreground">
              {isConnected
                ? isSpeaking
                  ? 'OptiDerma is speaking…'
                  : isMuted
                  ? 'Microphone muted'
                  : 'Listening to your question…'
                : isConnecting
                ? 'Connecting to ElevenLabs agent…'
                : 'ElevenLabs Voice Consultation'}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-muted border border-border text-muted-foreground">
              {connectionStateLabel}
            </span>
          </div>

          <p className="text-xs text-muted-foreground max-w-sm">
            {isConnected
              ? currentResult
                ? `Discussing active analysis [${currentResult.analysis_id ? currentResult.analysis_id.slice(0, 8) : 'OD-LIVE'}]. Ask about differential diagnosis, Grad-CAM focus, or physical calibration.`
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

// =============================================================================
// 2. OPTIDERMA FREE SPOKEN VOICE FALLBACK ASSISTANT (ZERO QUOTA LIMITS)
// =============================================================================

function FallbackVoiceAssistant({
  currentResult,
  booking,
  onSwitchToElevenLabs,
}: {
  currentResult: PredictResponse | null
  booking?: VoiceBookingHandlers
  onSwitchToElevenLabs?: () => void
}) {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [liveSpeech, setLiveSpeech] = useState('')
  const [textInput, setTextInput] = useState('')
  const [fallbackError, setFallbackError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [activeTtsProvider, setActiveTtsProvider] = useState<string>('gtts / web-speech')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])

interface SpeechRecognitionResultItem {
  transcript: string
  confidence?: number
}
interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResultItem[]
  [index: number]: SpeechRecognitionResultItem[] & { isFinal?: boolean }
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEventLike {
  error: string
}
interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Greet or explain active analysis on first mount
  const hasGreetedRef = useRef(false)
  useEffect(() => {
    if (!hasGreetedRef.current) {
      hasGreetedRef.current = true
      const greeting = currentResult
        ? `Hello! I am your OptiDerma Clinical Voice Assistant. I have loaded your active dermoscopic analysis for ${
            LESION_LABELS[currentResult.top3[0][0]]?.title || currentResult.top3[0][0].toUpperCase()
          }. You can speak or tap any question below to discuss findings, morphometrics, or doctor appointments.`
        : 'Hello! I am your OptiDerma Clinical Voice Assistant. Tap the microphone to ask questions about skin health, dermoscopic evaluation, or melanoma signs.'
      
      setTranscript([
        {
          id: 'welcome-msg',
          role: 'assistant',
          text: greeting,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          provider: 'local_greeting',
        },
      ])
    }
  }, [currentResult])

  // Stop any active audio and speech synthesis
  const stopAllSpeech = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllSpeech()
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop()
        } catch {
          // ignore
        }
      }
    }
  }, [stopAllSpeech])

  // 1. Play backend synthesized MP3 audio
  const playBase64Audio = useCallback(
    (b64Audio: string): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!b64Audio || isMuted) {
          resolve(false)
          return
        }
        stopAllSpeech()
        try {
          const audio = new Audio(`data:audio/mpeg;base64,${b64Audio}`)
          audioRef.current = audio
          setIsSpeaking(true)
          audio.onended = () => {
            setIsSpeaking(false)
            resolve(true)
          }
          audio.onerror = () => {
            setIsSpeaking(false)
            resolve(false)
          }
          audio.play().catch((err) => {
            console.warn('Audio play error, falling back to Web Speech:', err)
            setIsSpeaking(false)
            resolve(false)
          })
        } catch (e) {
          setIsSpeaking(false)
          resolve(false)
        }
      })
    },
    [isMuted, stopAllSpeech]
  )

  // 2. Web Speech API browser-native speech fallback (Zero Quota, 100% Free)
  const speakWithWebSpeech = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window) || isMuted) {
          resolve()
          return
        }
        stopAllSpeech()
        try {
          const clean = cleanSpeechText(text)
          if (!clean) {
            resolve()
            return
          }
          const utterance = new SpeechSynthesisUtterance(clean)
          utterance.rate = 1.0
          utterance.pitch = 1.0

          // Select natural English voice
          const voices = window.speechSynthesis.getVoices()
          const naturalVoice =
            voices.find(
              (v) =>
                v.lang.startsWith('en') &&
                (v.name.includes('Natural') ||
                  v.name.includes('Google') ||
                  v.name.includes('Jenny') ||
                  v.name.includes('Samantha') ||
                  v.name.includes('Female'))
            ) || voices.find((v) => v.lang.startsWith('en'))
          if (naturalVoice) utterance.voice = naturalVoice

          utterance.onstart = () => setIsSpeaking(true)
          utterance.onend = () => {
            setIsSpeaking(false)
            resolve()
          }
          utterance.onerror = () => {
            setIsSpeaking(false)
            resolve()
          }
          window.speechSynthesis.speak(utterance)
        } catch (err) {
          setIsSpeaking(false)
          resolve()
        }
      })
    },
    [isMuted, stopAllSpeech]
  )

  // Core handler: process a text or spoken query
  const processQuery = useCallback(
    async (queryText: string, audioBlob?: Blob) => {
      const q = queryText.trim()
      if (!q && !audioBlob) return

      stopAllSpeech()
      setIsProcessing(true)
      setFallbackError(null)

      const userEntryId = Math.random().toString(36).substring(2, 9)
      const userMsg = q || 'Spoken Question'

      setTranscript((prev) => [
        ...prev,
        {
          id: userEntryId,
          role: 'user',
          text: userMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      setLiveSpeech('')
      setTextInput('')

      // Detect appointment booking intent directly
      const qLower = userMsg.toLowerCase()
      if (
        qLower.includes('book') ||
        qLower.includes('appointment') ||
        qLower.includes('schedule') ||
        qLower.includes('see a dermatologist') ||
        qLower.includes('see a doctor')
      ) {
        if (booking) {
          booking.onOpenBooking({ reason: 'Dermatology consultation' })
        }
        const bookingAnswer =
          'I have opened the appointment booking form on your screen. You can select an available dermatologist slot and confirm your consultation.'
        const asstId = Math.random().toString(36).substring(2, 9)
        setTranscript((prev) => [
          ...prev,
          {
            id: asstId,
            role: 'assistant',
            text: bookingAnswer,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            provider: 'web-speech',
          },
        ])
        setActiveTtsProvider('web-speech')
        setIsProcessing(false)
        await speakWithWebSpeech(bookingAnswer)
        return
      }

      // Submit to backend voice-turn pipeline
      try {
        const res = await submitVoiceTurn({
          query: userMsg,
          audioBlob,
          analysisId: currentResult?.analysis_id,
          conversationId,
          outputAudio: true,
        })

        if (res && res.answer) {
          if (res.conversation_id) setConversationId(res.conversation_id)
          const provider = res.tts_provider || (res.audio_base64 ? 'gtts' : 'web-speech')
          setActiveTtsProvider(provider)

          const asstId = Math.random().toString(36).substring(2, 9)
          setTranscript((prev) => [
            ...prev,
            {
              id: asstId,
              role: 'assistant',
              text: res.answer,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              audioBase64: res.audio_base64 || undefined,
              provider,
            },
          ])

          setIsProcessing(false)

          // Play synthesized audio or fallback to Web Speech
          if (res.audio_base64 && provider !== 'none') {
            const played = await playBase64Audio(res.audio_base64)
            if (!played) {
              const spoken = res.spoken_text || cleanSpeechText(res.answer)
              await speakWithWebSpeech(spoken)
            }
          } else {
            const spoken = res.spoken_text || cleanSpeechText(res.answer)
            await speakWithWebSpeech(spoken)
          }
        } else {
          throw new Error('No answer returned from voice pipeline.')
        }
      } catch (err: unknown) {
        console.warn('Backend voice turn error, utilizing local clinical reasoner:', err)
        const localAnswer = generateLocalClinicalResponse(userMsg, currentResult)
        const asstId = Math.random().toString(36).substring(2, 9)
        setActiveTtsProvider('local-clinical-reasoner')

        setTranscript((prev) => [
          ...prev,
          {
            id: asstId,
            role: 'assistant',
            text: localAnswer,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            provider: 'local-clinical-reasoner',
          },
        ])
        setIsProcessing(false)
        await speakWithWebSpeech(localAnswer)
      }
    },
    [booking, conversationId, currentResult, playBase64Audio, speakWithWebSpeech, stopAllSpeech]
  )

  // Start browser speech recognition
  const startListening = () => {
    stopAllSpeech()
    setFallbackError(null)

    if (typeof window === 'undefined') return
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance
    }
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition

    if (SpeechRec) {
      try {
        const recognition = new SpeechRec()
        recognition.continuous = false
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onstart = () => {
          setIsListening(true)
          setLiveSpeech('')
        }

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          let interim = ''
          let final = ''
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript
            } else {
              interim += event.results[i][0].transcript
            }
          }
          if (final) {
            setLiveSpeech(final)
            setIsListening(false)
            processQuery(final)
          } else if (interim) {
            setLiveSpeech(interim)
          }
        }

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
          setIsListening(false)
          if (event.error === 'not-allowed') {
            setFallbackError('Microphone permission was denied. Please allow microphone access in your browser settings.')
          } else if (event.error !== 'no-speech') {
            setFallbackError(`Speech recognition note: ${event.error}`)
          }
        }

        recognition.onend = () => {
          setIsListening(false)
        }

        recognitionRef.current = recognition
        recognition.start()
        return
      } catch (err) {
        console.warn('SpeechRecognition failed to start, falling back to MediaRecorder:', err)
      }
    }

    // MediaRecorder fallback for browsers without SpeechRecognition API
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        setIsListening(true)
        const mediaRecorder = new MediaRecorder(stream)
        audioChunksRef.current = []

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data)
        }

        mediaRecorder.onstop = () => {
          setIsListening(false)
          stream.getTracks().forEach((track) => track.stop())
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          if (audioBlob.size > 500) {
            processQuery('', audioBlob)
          }
        }

        mediaRecorderRef.current = mediaRecorder
        mediaRecorder.start()
      })
      .catch((err) => {
        setIsListening(false)
        setFallbackError('Microphone access is required for voice consultation. Please enable microphone permissions in your browser.')
      })
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // ignore
      }
    }
    setIsListening(false)
    if (liveSpeech.trim()) {
      processQuery(liveSpeech.trim())
    }
  }

  const handleToggleListening = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  // Quick prompt chips
  const suggestedChips = currentResult
    ? [
        { label: 'Differential diagnosis', query: 'Explain my differential diagnosis rankings and probabilities in detail.' },
        { label: 'Malignancy risk', query: 'What is my malignant probability and recommended next step?' },
        { label: 'Morphological metrics', query: 'Explain the measured lesion area, asymmetry, and compactness.' },
        { label: 'Grad-CAM heatmap', query: 'What do the Grad-CAM highlighted heatmap and segmentation contour represent?' },
        { label: 'Book dermatologist', query: 'Please help me book a consultation with a certified dermatologist.' },
      ]
    : [
        { label: 'ABCDE melanoma rules', query: 'What are the ABCDE clinical warning signs for melanoma?' },
        { label: 'Eczema vs psoriasis', query: 'What are the key clinical differences between eczema and psoriasis?' },
        { label: 'Skin protection tips', query: 'How should I best protect my skin from ultraviolet radiation and sun damage?' },
        { label: 'Book dermatologist', query: 'I would like to schedule an appointment with a dermatologist.' },
      ]

  return (
    <div className="w-full space-y-5">
      {/* Fallback Active Badge Header */}
      <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
          <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-bold">
            OptiDerma Free Voice Fallback Active
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
            Zero Quota Limits
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Engine: Whisper STT · gTTS / Web Speech</span>
          {onSwitchToElevenLabs && (
            <button
              type="button"
              onClick={onSwitchToElevenLabs}
              className="font-semibold text-primary hover:underline ml-1"
            >
              Try ElevenLabs WebRTC →
            </button>
          )}
        </div>
      </div>

      {/* Error alert if any */}
      {fallbackError && (
        <div
          role="alert"
          className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{fallbackError}</span>
          </div>
          <button
            type="button"
            onClick={() => setFallbackError(null)}
            className="text-[11px] font-bold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Central Interactive Voice Card */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-xs flex flex-col items-center text-center space-y-5">
        {/* Pulsing Visualizer Orb */}
        <div className="relative">
          <div
            onClick={handleToggleListening}
            role="button"
            tabIndex={0}
            aria-label={isListening ? 'Stop listening' : 'Start speaking'}
            className={`size-24 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ${
              isListening
                ? 'bg-red-500/20 text-red-600 ring-8 ring-red-500/30 scale-105 animate-pulse'
                : isProcessing
                ? 'bg-amber-500/20 text-amber-600 ring-4 ring-amber-500/20 animate-spin'
                : isSpeaking
                ? 'bg-primary/20 text-primary ring-8 ring-primary/20 scale-105'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:ring-4 hover:ring-emerald-500/20'
            }`}
          >
            {isListening ? (
              <Mic className="size-10 text-red-600 animate-bounce" />
            ) : isProcessing ? (
              <RotateCcw className="size-10 animate-spin" />
            ) : isSpeaking ? (
              <Volume2 className="size-10 animate-pulse text-primary" />
            ) : (
              <Mic className="size-10" />
            )}
          </div>

          {/* Active status indicator dot */}
          <span
            className={`absolute bottom-0 right-0 size-5 rounded-full border-2 border-background ${
              isListening
                ? 'bg-red-500'
                : isProcessing
                ? 'bg-amber-500'
                : isSpeaking
                ? 'bg-primary'
                : 'bg-emerald-500'
            }`}
          />
        </div>

        {/* State Label */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-base font-bold text-foreground">
              {isListening
                ? 'Listening to you speak…'
                : isProcessing
                ? 'Analyzing clinical response…'
                : isSpeaking
                ? 'OptiDerma is speaking…'
                : 'OptiDerma Voice Consultation'}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-muted border border-border text-muted-foreground">
              {isListening
                ? 'Listening'
                : isProcessing
                ? 'Thinking'
                : isSpeaking
                ? 'Speaking'
                : 'Ready'}
            </span>
          </div>

          <p className="text-xs text-muted-foreground max-w-sm">
            {isListening
              ? 'Speak naturally into your microphone. Tap the button when finished.'
              : isSpeaking
              ? 'Synthesizing voice response grounded in dermatological evidence.'
              : currentResult
              ? `Grounded in active lesion [${currentResult.analysis_id ? currentResult.analysis_id.slice(0, 8) : 'ACTIVE'}]. Tap the mic or choose a prompt below.`
              : 'Tap the mic or pick a prompt to discuss dermatological conditions and guidelines.'}
          </p>
        </div>

        {/* Live spoken preview during listening */}
        {liveSpeech && (
          <div className="w-full max-w-md p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-foreground italic flex items-center gap-2 animate-fadeIn">
            <Radio className="size-3.5 text-primary animate-pulse shrink-0" />
            <span>&ldquo;{liveSpeech}&rdquo;</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleToggleListening}
            disabled={isProcessing}
            className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-full font-bold text-xs shadow-xs transition-all disabled:opacity-50 ${
              isListening
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isListening ? (
              <>
                <Square className="size-3.5 fill-white" />
                Done Speaking
              </>
            ) : (
              <>
                <Mic className="size-4" />
                Tap to Speak
              </>
            )}
          </button>

          {isSpeaking && (
            <button
              type="button"
              onClick={stopAllSpeech}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors"
            >
              <Square className="size-3.5 text-red-500 fill-red-500" />
              Stop Voice
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs font-semibold transition-colors ${
              isMuted
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-border bg-card hover:bg-muted text-foreground'
            }`}
            aria-label={isMuted ? 'Unmute voice' : 'Mute voice'}
          >
            {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            {isMuted ? 'Muted' : 'Sound On'}
          </button>
        </div>

        {/* Quick Voice Prompt Chips */}
        <div className="w-full max-w-lg pt-2 space-y-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Suggested Consultation Queries
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestedChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => processQuery(chip.query)}
                disabled={isProcessing || isListening}
                className="px-3 py-1.5 rounded-full border border-border/80 bg-background hover:bg-muted text-foreground text-xs font-medium transition-colors hover:border-primary/40 disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Text Input Bar Alternative */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (textInput.trim() && !isProcessing) {
              processQuery(textInput)
            }
          }}
          className="w-full max-w-md flex items-center gap-2 pt-2"
        >
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type a question to hear spoken response…"
            disabled={isProcessing}
            className="flex-1 px-4 py-2 rounded-xl border border-border bg-background text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={!textInput.trim() || isProcessing}
            className="p-2.5 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
            aria-label="Send query"
          >
            <Send className="size-3.5" />
          </button>
        </form>
      </div>

      {/* Conversation Transcript Log */}
      {transcript.length > 0 && (
        <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Consultation Dialogue Log
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                TTS: {activeTtsProvider}
              </span>
              <button
                type="button"
                onClick={() => {
                  stopAllSpeech()
                  setTranscript([])
                }}
                className="text-[10px] text-muted-foreground hover:text-foreground underline ml-2"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {transcript.map((entry) => (
              <div
                key={entry.id}
                className={`p-3 rounded-xl text-xs leading-relaxed space-y-1.5 ${
                  entry.role === 'assistant'
                    ? 'bg-primary/10 text-foreground border border-primary/20 mr-6'
                    : 'bg-muted/70 text-foreground ml-6'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                  <div className="flex items-center gap-1.5">
                    {entry.role === 'assistant' ? (
                      <>
                        <Bot className="size-3 text-primary" />
                        <span>OptiDerma Clinical Voice</span>
                      </>
                    ) : (
                      <>
                        <User className="size-3" />
                        <span>You</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{entry.timestamp}</span>
                    {entry.role === 'assistant' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (entry.audioBase64) {
                            playBase64Audio(entry.audioBase64)
                          } else {
                            speakWithWebSpeech(entry.text)
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-bold"
                        title="Replay Voice"
                      >
                        <Play className="size-2.5 fill-primary" />
                        Replay
                      </button>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-line">{entry.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// 3. MAIN EXPORT: DUAL-ENGINE VOICE ASSISTANT WITH AUTOMATIC FALLBACK
// =============================================================================

interface VoiceErrorBoundaryProps {
  children: React.ReactNode
  fallback: (error: Error) => React.ReactNode
}

interface VoiceErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class VoiceErrorBoundary extends React.Component<VoiceErrorBoundaryProps, VoiceErrorBoundaryState> {
  constructor(props: VoiceErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): VoiceErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('ElevenLabs Voice Provider stream caught by ErrorBoundary:', error.message, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error)
    }
    return this.props.children
  }
}

export function VoiceAssistant({
  currentResult,
  booking,
}: {
  currentResult: PredictResponse | null
  booking?: VoiceBookingHandlers
}) {
  const [engineMode, setEngineMode] = useState<'elevenlabs' | 'fallback'>('fallback')
  const [switchReason, setSwitchReason] = useState<string | null>(null)

  // Load user engine preference from localStorage if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('optiderma_voice_engine')
      if (saved === 'fallback') {
        setEngineMode('fallback')
      }
    }
  }, [])

  const handleSelectEngine = (mode: 'elevenlabs' | 'fallback') => {
    setEngineMode(mode)
    setSwitchReason(null)
    if (typeof window !== 'undefined') {
      localStorage.setItem('optiderma_voice_engine', mode)
    }
  }

  const handleSwitchToFallback = (reason?: string) => {
    setSwitchReason(reason || 'Switched to local spoken dialogue')
    setEngineMode('fallback')
    if (typeof window !== 'undefined') {
      localStorage.setItem('optiderma_voice_engine', 'fallback')
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Top Engine Selector Tabs */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => handleSelectEngine('fallback')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              engineMode === 'fallback'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldCheck className="size-3 text-emerald-500" />
            Free Voice Fallback
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
              Unlimited
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectEngine('elevenlabs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              engineMode === 'elevenlabs'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Radio className="size-3 text-sky-500" />
            ElevenLabs WebRTC
          </button>
        </div>

        <div className="text-xs text-muted-foreground hidden sm:block">
          {engineMode === 'elevenlabs' ? (
            <span className="text-sky-600 dark:text-sky-400 font-medium">Cloud WebRTC Stream</span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Zero Quota Limits · gTTS / Web Speech</span>
          )}
        </div>
      </div>

      {/* Switch Notification Banner if auto-switched */}
      {switchReason && engineMode === 'fallback' && (
        <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <b>Active Engine:</b> {switchReason}. Unlimited spoken turns are available.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSwitchReason(null)}
            className="text-xs underline font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Voice Assistant Component */}
      {engineMode === 'elevenlabs' ? (
        <VoiceErrorBoundary
          fallback={(err) => (
            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs">
                ElevenLabs WebRTC connection failed ({err.message}). Switched to Free Voice Fallback below.
              </div>
              <FallbackVoiceAssistant
                currentResult={currentResult}
                booking={booking}
                onSwitchToElevenLabs={() => handleSelectEngine('elevenlabs')}
              />
            </div>
          )}
        >
          <ConversationProvider>
            <InnerVoiceAssistant
              currentResult={currentResult}
              booking={booking}
              onSwitchToFallback={handleSwitchToFallback}
            />
          </ConversationProvider>
        </VoiceErrorBoundary>
      ) : (
        <FallbackVoiceAssistant
          currentResult={currentResult}
          booking={booking}
          onSwitchToElevenLabs={() => handleSelectEngine('elevenlabs')}
        />
      )}
    </div>
  )
}
