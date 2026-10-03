'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ConversationProvider, useConversation } from '@elevenlabs/react'
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

export function formatAnalysisSummary(result: PredictResponse | null): string {
  if (!result) return 'No analysis yet'

  const topPredictions = result.top3
    .map(([cls, prob]) => {
      const label = LESION_LABELS[cls]?.title || cls.toUpperCase()
      return `${label}: ${(prob * 100).toFixed(1)}%`
    })
    .join(', ')

  const measurements = `Area ${result.metrics.area_mm2.toFixed(1)} mm², Perimeter ${result.metrics.perimeter_mm.toFixed(1)} mm, Asymmetry ${result.metrics.asymmetry_index.toFixed(2)}, Compactness ${result.metrics.compactness.toFixed(2)}, Coverage ${result.metrics.coverage_pct.toFixed(1)}%`

  return `Risk classification: ${result.risk.level} (${result.risk.recommendation}). Top 3 differential diagnoses: ${topPredictions}. Higher-concern group probability: ${(result.malignant_prob * 100).toFixed(1)}%. Measurements: ${measurements}. Research prototype only, not a clinical diagnosis.`
}

interface TranscriptEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: string
}

function InnerVoiceAssistant({
  currentResult,
}: {
  currentResult: PredictResponse | null
}) {
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [micPermissionDenied, setMicPermissionDenied] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [inactivityCountdown, setInactivityCountdown] = useState<number | null>(null)

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActiveResultRef = useRef<PredictResponse | null>(currentResult)

  const INACTIVITY_TIMEOUT_MS = 90_000 // 90 seconds of inactivity auto-ends call

  const conversation = useConversation({
    onConnect: () => {
      setSessionError(null)
      resetInactivityTimer()
    },
    onDisconnect: () => {
      clearInactivityTimers()
    },
    onError: (err: unknown) => {
      const message = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Voice session error'
      setSessionError(message)
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

  // Manage auto-end after inactivity
  const clearInactivityTimers = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    setInactivityCountdown(null)
  }, [])

  const resetInactivityTimer = useCallback(() => {
    clearInactivityTimers()
    if (!isConnected) return

    // Show warning countdown in the last 20 seconds
    const warningMs = INACTIVITY_TIMEOUT_MS - 20_000

    inactivityTimerRef.current = setTimeout(() => {
      let secondsLeft = 20
      setInactivityCountdown(secondsLeft)
      countdownIntervalRef.current = setInterval(() => {
        secondsLeft -= 1
        if (secondsLeft <= 0) {
          clearInactivityTimers()
          conversation.endSession()
        } else {
          setInactivityCountdown(secondsLeft)
        }
      }, 1000)
    }, warningMs)
  }, [clearInactivityTimers, isConnected, conversation])

  useEffect(() => {
    return () => {
      clearInactivityTimers()
    }
  }, [clearInactivityTimers])

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
      setSessionError('Microphone permission is required to converse with the voice assistant.')
      return
    }

    try {
      // Fetch signed URL from our Next.js API route
      const res = await fetch('/api/voice-session')
      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}))
        throw new Error(
          errorJson.error || `Voice session failed with status ${res.status}`
        )
      }
      const data = await res.json()
      if (!data.signedUrl) {
        throw new Error('No signedUrl received from voice session endpoint.')
      }

      const summaryText = formatAnalysisSummary(currentResult)

      // Start ElevenLabs conversation with text-only dynamic variable (NEVER image bytes)
      await conversation.startSession({
        signedUrl: data.signedUrl,
        dynamicVariables: {
          analysis_summary: summaryText,
        },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setSessionError(msg)
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
}: {
  currentResult: PredictResponse | null
}) {
  return (
    <ConversationProvider>
      <InnerVoiceAssistant currentResult={currentResult} />
    </ConversationProvider>
  )
}
