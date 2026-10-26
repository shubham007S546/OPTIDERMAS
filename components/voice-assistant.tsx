'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Mic,
  MicOff,
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
} from 'lucide-react'
import { LESION_LABELS, type PredictResponse } from '@/lib/types'
import type { BookingConfirmation } from '@/lib/booking'
import { submitVoiceTurn } from '@/lib/api'
import type { BookingPrefill } from './booking-dialog'

export interface VoiceBookingHandlers {
  /** Agent asked to open the booking form (optionally prefilled); the user confirms by clicking. */
  onOpenBooking: (prefill: BookingPrefill) => void
  /** Agent completed a booking directly after the user verbally confirmed the details. */
  onAgentBooked: (booking: BookingConfirmation) => void
}

export interface TranscriptEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: string
  audioBase64?: string
  provider?: string
}

export function formatAnalysisSummary(result: PredictResponse | null): string {
  if (!result) return 'No lesion analysis yet. You can upload and analyze a dermoscopic photo on the Analyse tab.'

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
    return 'I am OptiDerma Voice Assistant. You can upload a dermoscopic skin photo on the Analyse tab to receive live classification, risk stratification, and plain-language patient advice.'
  }

  const top = result.top3[0]
  const topCode = top ? top[0] : 'nv'
  const topInfo = LESION_LABELS[topCode] || { title: topCode.toUpperCase() }
  const topScore = top ? Math.round(top[1] * 100) : 0

  if (q.includes('malignant') || q.includes('cancer') || q.includes('risk') || q.includes('danger')) {
    return `Your active analysis indicates a ${result.risk.level} risk profile. The primary match is ${topInfo.title} at ${topScore}% confidence. Malignancy pool probability is ${(result.malignant_prob * 100).toFixed(1)}%. Recommendation: ${result.risk.recommendation}`
  }

  if (q.includes('size') || q.includes('measurement') || q.includes('asymmetry') || q.includes('metric')) {
    return `The segmented lesion measures approximately ${result.metrics.area_mm2.toFixed(1)} square millimeters, with an asymmetry index of ${result.metrics.asymmetry_index.toFixed(2)} and compactness of ${result.metrics.compactness.toFixed(2)}. ${result.metrics.asymmetry_index < 0.25 ? 'The contour is relatively symmetric.' : 'Mild contour asymmetry was detected.'}`
  }

  if (q.includes('doctor') || q.includes('book') || q.includes('appointment')) {
    return 'I can help you coordinate an appointment with a nearby dermatology clinic. Click Care Connect to view verified clinics or request an appointment directly.'
  }

  return `Regarding your spot: the top finding is ${topInfo.title} with a ${result.risk.level} triage tier. Would you like me to explain the differential diagnosis, review the ABCDE criteria, or help book a dermatologist visit?`
}

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

export function VoiceAssistant({
  currentResult,
  booking,
}: {
  currentResult: PredictResponse | null
  booking?: VoiceBookingHandlers
}) {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [liveSpeech, setLiveSpeech] = useState('')
  const [textInput, setTextInput] = useState('')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [activeTtsProvider, setActiveTtsProvider] = useState<string>('Native Web Speech / gTTS')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])

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
        ? `Hello! I am your OptiDerma Clinical Voice Assistant. I have loaded your skin spot analysis for ${
            LESION_LABELS[currentResult.top3[0][0]]?.title || currentResult.top3[0][0].toUpperCase()
          }. Tap the microphone or any question chip below to speak.`
        : 'Hello! I am your OptiDerma Voice Assistant. Tap the microphone to ask any questions about skin health, mole checks, or dermatology guidelines.'

      setTranscript([
        {
          id: 'welcome-msg',
          role: 'assistant',
          text: greeting,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          provider: 'free_native_voice',
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
        } catch {
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
          utterance.rate = 0.95
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
        } catch {
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
      setVoiceError(null)

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
          'I have opened the appointment booking form on your screen. You can select an available dermatologist clinic and confirm your consultation date.'
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
        setActiveTtsProvider('Native Web Speech')
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
          setActiveTtsProvider(provider === 'gtts' ? 'gTTS Audio' : 'Web Speech API')

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
        setActiveTtsProvider('Local Clinical AI')

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
    setVoiceError(null)

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
            setVoiceError('Microphone permission was denied. Please allow microphone access in your browser settings.')
          } else if (event.error !== 'no-speech') {
            setVoiceError(`Speech recognition note: ${event.error}`)
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
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
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
        .catch(() => {
          setIsListening(false)
          setVoiceError('Microphone access is required for voice consultation. Please enable microphone permissions in your browser.')
        })
    } else {
      setVoiceError('Voice input is not supported in this browser. You can type questions in the box below.')
    }
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
    <div className="w-full space-y-5 animate-in fade-in duration-300">
      {/* Free Voice Engine Header Banner */}
      <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
          <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-bold">
            OptiDerma Free Native Voice Assistant
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
            100% Free · Zero Subscription
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
          <span>Engine: Web Speech API &amp; Whisper Audio Turn</span>
        </div>
      </div>

      {/* Error alert if any */}
      {voiceError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{voiceError}</span>
          </div>
          <button
            type="button"
            onClick={() => setVoiceError(null)}
            className="text-[11px] font-bold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Central Interactive Voice Card */}
      <div className="p-6 sm:p-8 rounded-3xl border border-border bg-card shadow-xs flex flex-col items-center text-center space-y-5">
        {/* Pulsing Visualizer Orb */}
        <div className="relative">
          <button
            type="button"
            onClick={handleToggleListening}
            aria-label={isListening ? 'Stop listening' : 'Start speaking'}
            className={`size-28 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ${
              isListening
                ? 'bg-rose-500/20 text-rose-600 ring-8 ring-rose-500/30 scale-105 animate-pulse'
                : isProcessing
                ? 'bg-amber-500/20 text-amber-600 ring-4 ring-amber-500/20 animate-spin'
                : isSpeaking
                ? 'bg-primary/20 text-primary ring-8 ring-primary/20 scale-105'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:ring-6 hover:ring-emerald-500/20 hover:scale-105'
            }`}
          >
            {isListening ? (
              <Mic className="size-11 text-rose-600 animate-bounce" />
            ) : isProcessing ? (
              <RotateCcw className="size-11 animate-spin" />
            ) : isSpeaking ? (
              <Volume2 className="size-11 animate-pulse text-primary" />
            ) : (
              <Mic className="size-11" />
            )}
          </button>

          {/* Active status indicator dot */}
          <span
            className={`absolute bottom-1 right-1 size-5 rounded-full border-2 border-background ${
              isListening
                ? 'bg-rose-500'
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
            <h3 className="text-lg font-bold text-foreground">
              {isListening
                ? 'Listening to your voice…'
                : isProcessing
                ? 'Reasoning clinical answer…'
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

          <p className="text-xs text-muted-foreground max-w-md">
            {isListening
              ? 'Speak naturally into your microphone. Tap the button when finished.'
              : isSpeaking
              ? 'Synthesizing voice response grounded in dermatological guidelines.'
              : currentResult
              ? `Grounded in active skin spot [${currentResult.analysis_id ? currentResult.analysis_id.slice(0, 8) : 'ACTIVE'}]. Tap the mic or choose a query below.`
              : 'Tap the mic or pick a prompt to discuss dermatological signs, moles, and care guidelines.'}
          </p>
        </div>

        {/* Live spoken preview during listening */}
        {liveSpeech && (
          <div className="w-full max-w-md p-3.5 rounded-2xl bg-primary/5 border border-primary/20 text-xs text-foreground italic flex items-center gap-2 animate-in fade-in">
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
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
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
              <Square className="size-3.5 text-rose-500 fill-rose-500" />
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
            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/30"
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
        <div className="p-5 rounded-3xl border border-border bg-card space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Consultation Dialogue Log
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-medium">
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
                Clear Log
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {transcript.map((entry) => (
              <div
                key={entry.id}
                className={`p-3.5 rounded-2xl text-xs leading-relaxed space-y-1.5 ${
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
                        <span className="font-bold">OptiDerma Clinical Voice</span>
                      </>
                    ) : (
                      <>
                        <User className="size-3" />
                        <span className="font-bold">You</span>
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
