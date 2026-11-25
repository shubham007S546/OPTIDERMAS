'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  FileText,
  GitCompare,
  Heart,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UploadCloud,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { NavigationDestination } from './clinical-sidebar'

interface ProjectDemoVideoProps {
  onNavigate: (dest: NavigationDestination) => void
  onOpenCareConnect: () => void
}

interface DemoChapter {
  id: string
  stepNumber: string
  title: string
  shortLabel: string
  durationLabel: string
  howToUse: string
  detailedFeatureNote: string
  narration: string
  actionLabel: string
  actionType: 'analyze' | 'council' | 'consult-chat' | 'history' | 'reports' | 'knowledge' | 'care-connect'
  badgeColor: string
}

const DEMO_CHAPTERS: DemoChapter[] = [
  {
    id: 'modes',
    stepNumber: '01',
    title: 'Dual-Persona Workspace & Privacy Vault',
    shortLabel: 'Modes & Privacy',
    durationLabel: '0:00 – 0:08',
    howToUse: 'Switch between "For Patients" (plain everyday English) and "Clinician View" (technical telemetry) at the top of any screen.',
    detailedFeatureNote: 'OptiDerma runs zero ad trackers, streams raw uncompressed image bytes, persists cases locally in SQLite WAL, and wakes the AI backend silently on load.',
    narration: 'Step one: Choose For Patients for warm, simple explanations, or Clinician View for deep medical metrics. Your photos always stay private.',
    actionLabel: 'Open System Privacy & Health',
    actionType: 'knowledge',
    badgeColor: 'emerald',
  },
  {
    id: 'upload',
    stepNumber: '02',
    title: 'Upload Photo, Camera & DullRazor Cleaning',
    shortLabel: 'Upload & Clean',
    durationLabel: '0:08 – 0:16',
    howToUse: 'Drag & drop any JPG/PNG/WEBP skin photo, tap Use Camera, or test instantly with the 3 verified 1-click Demo Cases.',
    detailedFeatureNote: 'Before AI prediction runs, Image Quality Assessment (IQA) checks sharpness and DullRazor morphological filtering automatically removes overlying hair strands without distorting lesion borders.',
    narration: 'Step two: Upload your skin spot or pick an instant demo case. OptiDerma checks photo clarity and removes hair strands cleanly before scanning.',
    actionLabel: 'Try Skin Analysis Upload',
    actionType: 'analyze',
    badgeColor: 'sky',
  },
  {
    id: 'inference',
    stepNumber: '03',
    title: 'PyTorch 7-Class Screening & Risk Stratification',
    shortLabel: 'AI Triage',
    durationLabel: '0:16 – 0:24',
    howToUse: 'Click "Run Model Inference" to compute scores across all 7 HAM10000 skin categories, Malignant Pool %, and clear Low/Moderate/High guidance.',
    detailedFeatureNote: 'Applies our Adaptive Differential Rule (Delta >= 20% highlights a clear top candidate) plus an automatic Out-of-Distribution (OOD) advisory banner if a photo is non-dermoscopic.',
    narration: 'Step three: Our EfficientNet-B4 and U-Net engine screens seven dermatology classes, flags Out-of-Distribution photos, and explains risk clearly.',
    actionLabel: 'Launch Skin Classifier',
    actionType: 'analyze',
    badgeColor: 'indigo',
  },
  {
    id: 'xai',
    stepNumber: '04',
    title: 'Explainable AI Studio (Views A–H) & ABCDE Check',
    shortLabel: 'XAI Studio A–H',
    durationLabel: '0:24 – 0:32',
    howToUse: 'Inspect Views A through H (Raw, Grad-CAM Heatmap with Opacity Slider, U-Net Contour, Spatial Energy %, Multi-Class Compare, De-Haired, Hair Mask).',
    detailedFeatureNote: 'Includes pixel-accurate morphometrics (area, perimeter, asymmetry, compactness) plus an interactive 5-step ABCDE mole self-check and calendar follow-up export.',
    narration: 'Step four: Switch across eight Explainable AI views from Grad-CAM heatmaps to U-Net borders, and complete your interactive ABCDE checklist.',
    actionLabel: 'Explore Analysis Studio',
    actionType: 'analyze',
    badgeColor: 'teal',
  },
  {
    id: 'council',
    stepNumber: '05',
    title: '6-Agent Clinical Council Deliberation',
    shortLabel: '6-Agent Council',
    durationLabel: '0:32 – 0:40',
    howToUse: 'Open the Multi-Agent Council tab to see 6 autonomous specialists verify safety, vision features, math invariants, guidelines, care, and empathy.',
    detailedFeatureNote: 'Every scan undergoes independent Critic verification (verifying probability sum = 1.0, localization energy, and clinical disclaimers) and computes consensus agreement %. ',
    narration: 'Step five: Six specialized AI agents—including a strict Mathematical Critic—audit every finding independently before presenting a verified consensus.',
    actionLabel: 'Meet Multi-Agent Council',
    actionType: 'council',
    badgeColor: 'violet',
  },
  {
    id: 'ragchat',
    stepNumber: '06',
    title: 'Fast Grounded Dermatology RAG Chat & Citations',
    shortLabel: 'RAG AI Chat',
    durationLabel: '0:40 – 0:48',
    howToUse: 'Ask follow-up questions in plain English or Specialist mode. Click any [CIT-1] pill inside a reply to read the exact medical guideline excerpt.',
    detailedFeatureNote: 'Hybrid BM25 retrieval searches 48+ peer-reviewed AAD, BAD, NCCN, and IDS guidelines in milliseconds, synthesized fast via low-latency Groq LLM with emergency red-flag guards.',
    narration: 'Step six: Ask any follow-up skin question in AI Chat. Replies arrive in seconds grounded in peer-reviewed guidelines with clickable citations.',
    actionLabel: 'Open AI Dermatology Chat',
    actionType: 'consult-chat',
    badgeColor: 'blue',
  },
  {
    id: 'care',
    stepNumber: '07',
    title: 'Care Connect Clinics, PDF Reports & Evolution Tracker',
    shortLabel: 'Care & Reports',
    durationLabel: '0:48 – 0:56',
    howToUse: 'Search verified dermatology hospitals by PIN code, download your official PDF Report, or select 2 scans in History to track mole evolution.',
    detailedFeatureNote: 'Care Connect never fabricates doctors or clinics—matching verified centers (AIIMS, PGIMER, CMC Vellore, eSanjeevani) and compiling pre-visit consultation packets for your doctor.',
    narration: 'Step seven: Find verified dermatologists by PIN code, download a publication-grade PDF report, and compare scans over time in History.',
    actionLabel: 'Open Care Connect Directory',
    actionType: 'care-connect',
    badgeColor: 'rose',
  },
]

const STEP_DURATION_MS = 7200

/** Gesture Cursor helper showing animated pointer movements + click ripple circles inside the demo viewport. */
function AnimatedGestureCursor({
  x,
  y,
  label,
  isClicking = true,
}: {
  x: string
  y: string
  label?: string
  isClicking?: boolean
}) {
  const reduced = useReducedMotion()
  if (reduced) return null

  return (
    <motion.div
      initial={{ left: '50%', top: '75%', opacity: 0 }}
      animate={{ left: x, top: y, opacity: 1 }}
      transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
      className="absolute z-30 pointer-events-none select-none flex items-center gap-1.5"
    >
      <div className="relative">
        {isClicking && (
          <>
            <motion.span
              animate={{ scale: [0.6, 2.2], opacity: [0.85, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
              className="absolute -inset-2 rounded-full border-2 border-sky-400 bg-sky-400/20"
            />
            <motion.span
              animate={{ scale: [0.8, 1.6], opacity: [0.7, 0] }}
              transition={{ duration: 1.4, delay: 0.25, repeat: Infinity, ease: 'easeOut' }}
              className="absolute -inset-1 rounded-full bg-emerald-400/30"
            />
          </>
        )}
        <div className="w-7 h-7 rounded-full bg-white text-slate-900 shadow-lg border border-slate-300 flex items-center justify-center">
          <MousePointer2 size={14} className="fill-slate-900 text-slate-900 -rotate-12" />
        </div>
      </div>
      {label && (
        <motion.span
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="px-2 py-0.5 rounded-full bg-slate-950/90 text-white text-[10px] font-bold shadow-md whitespace-nowrap border border-white/15"
        >
          {label}
        </motion.span>
      )}
    </motion.div>
  )
}

export function ProjectDemoVideo({
  onNavigate,
  onOpenCareConnect,
}: ProjectDemoVideoProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5>(1)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [progressPct, setProgressPct] = useState(0)
  const reducedMotion = useReducedMotion()

  const activeChapter = DEMO_CHAPTERS[activeIndex]

  const speakNarration = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = playbackSpeed === 1.5 ? 1.15 : 1.0
    window.speechSynthesis.speak(utter)
  }, [playbackSpeed])

  // Stop speech cleanly on unmount or mute
  useEffect(() => {
    if (!voiceEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [voiceEnabled])

  // Narrate whenever step changes with voiceover enabled
  useEffect(() => {
    if (voiceEnabled && isPlaying) {
      speakNarration(activeChapter.narration)
    }
  }, [activeIndex, voiceEnabled, isPlaying, activeChapter.narration, speakNarration])

  // Smooth playback timer & scrubber
  useEffect(() => {
    if (!isPlaying || reducedMotion) return
    const effectiveDuration = STEP_DURATION_MS / playbackSpeed
    const startedAt = Date.now()

    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt
      const pct = Math.min(100, (elapsed / effectiveDuration) * 100)
      setProgressPct(pct)
      if (elapsed >= effectiveDuration) {
        setActiveIndex((prev) => (prev + 1) % DEMO_CHAPTERS.length)
        setProgressPct(0)
      }
    }, 60)

    return () => clearInterval(tick)
  }, [activeIndex, isPlaying, playbackSpeed, reducedMotion])

  const selectChapter = (idx: number) => {
    setActiveIndex(idx)
    setProgressPct(0)
  }

  const handleLaunchFeature = () => {
    const t = activeChapter.actionType
    if (t === 'care-connect') {
      onOpenCareConnect()
    } else {
      onNavigate(t)
    }
  }

  return (
    <section
      aria-label="OptiDerma Interactive Project Demo Video"
      className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-8 shadow-xs space-y-5 overflow-hidden"
    >
      {/* Top Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 text-sky-800 text-xs font-bold border border-sky-200">
            <Play size={12} className="fill-sky-600 text-sky-600" />
            <span>01 / Interactive Guided Project Demo • Step-by-Step Walkthrough</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            How to Use OptiDerma: Complete Animated Feature Tour
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
            Watch every workflow step in action—from uploading a lesion photo and DullRazor cleaning to Grad-CAM explainability, 6-agent deliberation, fast grounded RAG chat, and verified clinic booking.
          </p>
        </div>

        {/* Quick Playback Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} className="fill-white" />}
            <span>{isPlaying ? 'Pause Demo' : 'Play Demo'}</span>
          </button>

          <button
            type="button"
            onClick={() => setVoiceEnabled((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              voiceEnabled
                ? 'bg-sky-50 border-sky-300 text-sky-800'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Toggle spoken step-by-step voiceover narration"
          >
            {voiceEnabled ? <Volume2 size={14} className="text-sky-600" /> : <VolumeX size={14} />}
            <span>{voiceEnabled ? 'Voiceover On' : 'Voiceover Off'}</span>
          </button>

          <button
            type="button"
            onClick={() => setPlaybackSpeed((s) => (s === 1 ? 1.5 : 1))}
            className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-mono font-bold text-slate-700 transition-colors cursor-pointer"
            title="Toggle playback speed"
          >
            {playbackSpeed}x
          </button>
        </div>
      </div>

      {/* Main Cinema Stage + Step-by-Step Guide Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: 16:9 Cinema Stage (7 cols) */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-xl">
          {/* Mock Browser / App Chrome Bar */}
          <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="font-mono text-slate-400 ml-2 truncate">
                optiderma.ai / step-{activeChapter.stepNumber}-{activeChapter.id}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold text-[10px] border border-sky-400/30">
                <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${isPlaying ? 'animate-pulse' : ''}`} />
                STEP {activeChapter.stepNumber} OF 07
              </span>
              <span className="font-mono text-[10px] text-slate-400 hidden sm:inline">
                {activeChapter.durationLabel}
              </span>
            </div>
          </div>

          {/* Animated Scene Canvas */}
          <div className="relative flex-1 min-h-[300px] sm:min-h-[340px] p-4 sm:p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/60 overflow-hidden flex items-center justify-center">
            {/* Subtle Ambient Radial Glow */}
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

            <AnimatePresence mode="wait">
              {/* SCENE 1: Dual Mode & Privacy Vault */}
              {activeChapter.id === 'modes' && (
                <motion.div
                  key="scene-modes"
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.97 }}
                  transition={{ duration: 0.35 }}
                  className="relative w-full max-w-lg space-y-4"
                >
                  <AnimatedGestureCursor x="64%" y="14%" label="Tap to Switch View" />

                  <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-700/80 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-200">Select Your Experience</span>
                      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-800 border border-slate-700">
                        <motion.span
                          animate={{ backgroundColor: ['#059669', '#1e293b', '#059669'] }}
                          transition={{ duration: 3.5, repeat: Infinity }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white flex items-center gap-1"
                        >
                          <Heart size={11} /> For Patients
                        </motion.span>
                        <motion.span
                          animate={{ backgroundColor: ['#1e293b', '#2563eb', '#1e293b'] }}
                          transition={{ duration: 3.5, repeat: Infinity }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-200 flex items-center gap-1"
                        >
                          <Stethoscope size={11} /> Clinician View
                        </motion.span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <motion.div
                        animate={{ borderColor: ['rgba(16,185,129,0.7)', 'rgba(51,65,85,0.6)', 'rgba(16,185,129,0.7)'] }}
                        transition={{ duration: 3.5, repeat: Infinity }}
                        className="p-3 rounded-xl bg-emerald-950/40 border space-y-1"
                      >
                        <span className="font-bold text-emerald-300 block">Plain-English Care</span>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          Zero medical jargon, clear ABCDE tips, home care dos &amp; don&apos;ts.
                        </p>
                      </motion.div>

                      <motion.div
                        animate={{ borderColor: ['rgba(51,65,85,0.6)', 'rgba(56,189,248,0.8)', 'rgba(51,65,85,0.6)'] }}
                        transition={{ duration: 3.5, repeat: Infinity }}
                        className="p-3 rounded-xl bg-sky-950/40 border space-y-1"
                      >
                        <span className="font-bold text-sky-300 block">Clinical XAI Studio</span>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          7-class scores, Grad-CAM Views A–H, pixel morphometrics.
                        </p>
                      </motion.div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                      <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <ShieldCheck size={13} /> 100% Private Local SQLite Vault
                      </span>
                      <span className="font-mono text-sky-300">Auto Backend Warmup Active</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* SCENE 2: Upload & DullRazor Hair Cleaning Sweep */}
              {activeChapter.id === 'upload' && (
                <motion.div
                  key="scene-upload"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                  className="relative w-full max-w-lg grid grid-cols-12 gap-3 items-center"
                >
                  <AnimatedGestureCursor x="28%" y="54%" label="Drop Raw Photo" />

                  {/* Dropzone animation */}
                  <div className="col-span-6 p-4 rounded-2xl border-2 border-dashed border-sky-400/60 bg-slate-900/80 text-center space-y-2 relative overflow-hidden">
                    <motion.div
                      animate={{ y: [-24, 0, -4, 0], opacity: [0.3, 1, 1, 0.9] }}
                      transition={{ duration: 2.8, repeat: Infinity }}
                      className="mx-auto w-11 h-11 rounded-xl bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-300"
                    >
                      <UploadCloud size={22} />
                    </motion.div>
                    <p className="text-xs font-bold text-white">Drop Photo / Demo Case</p>
                    <div className="flex flex-wrap justify-center gap-1 pt-1">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">Mole</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">AKIEC</span>
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold">Atypical</span>
                    </div>
                  </div>

                  {/* Animated DullRazor Hair Cleaning Visualizer */}
                  <div className="col-span-6 p-3.5 rounded-2xl border border-slate-700 bg-slate-900/90 space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-sky-300 flex items-center gap-1">
                        <Scissors size={11} /> DullRazor Cleanse
                      </span>
                      <span className="text-emerald-400 font-mono">Original Bytes</span>
                    </div>

                    <div className="relative h-28 rounded-xl bg-amber-950/50 border border-amber-700/40 overflow-hidden flex items-center justify-center">
                      {/* Simulated skin lesion */}
                      <div className="w-16 h-14 rounded-full bg-gradient-to-br from-amber-700 via-amber-900 to-stone-900 shadow-inner border border-amber-500/30" />

                      {/* Occluding dark hair strands that fade cleanly as laser sweeps */}
                      <motion.svg
                        viewBox="0 0 120 80"
                        animate={{ opacity: [0.9, 0.9, 0.05, 0.05, 0.9] }}
                        transition={{ duration: 4, repeat: Infinity }}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                      >
                        <path d="M10 15 Q 55 42 110 20" stroke="#0f172a" strokeWidth="2" fill="none" />
                        <path d="M18 65 Q 65 30 105 62" stroke="#0f172a" strokeWidth="1.8" fill="none" />
                        <path d="M35 8 Q 62 45 48 75" stroke="#0f172a" strokeWidth="1.5" fill="none" />
                      </motion.svg>

                      {/* Animated scanner wipe */}
                      <motion.div
                        animate={{ top: ['0%', '100%', '0%'] }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_12px_#22d3ee]"
                      />
                    </div>

                    <p className="text-[10px] text-slate-300 leading-tight">
                      Detects linear hairs, inpaints cleanly, preserves diagnostic border.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* SCENE 3: PyTorch Inference & Adaptive Differential */}
              {activeChapter.id === 'inference' && (
                <motion.div
                  key="scene-inference"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                  className="relative w-full max-w-lg p-4 rounded-2xl bg-slate-900/90 border border-slate-700/80 space-y-3"
                >
                  <AnimatedGestureCursor x="78%" y="22%" label="Adaptive Margin Rule" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu size={15} className="text-sky-400" />
                      <span className="text-xs font-bold text-white">EfficientNet-B4 • 7-Class Screening</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40">
                      Δ Margin ≥ 20%
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {[
                      { label: 'Melanocytic Nevus (NV)', pct: 84, color: 'from-emerald-500 to-teal-400', active: true },
                      { label: 'Benign Keratosis (BKL)', pct: 11, color: 'from-slate-500 to-slate-400', active: false },
                      { label: 'Basal Cell Carcinoma (BCC)', pct: 3, color: 'from-slate-600 to-slate-500', active: false },
                    ].map((row, idx) => (
                      <div key={row.label} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={row.active ? 'font-bold text-white' : 'text-slate-400'}>
                            {row.label}
                          </span>
                          <span className={`font-mono font-bold ${row.active ? 'text-emerald-300' : 'text-slate-400'}`}>
                            {row.pct}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${row.pct}%` }}
                            transition={{ duration: 1.0, delay: idx * 0.15 }}
                            className={`h-full rounded-full bg-gradient-to-r ${row.color}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[10px]">
                    <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30">
                      Risk: Low Concern • Uncalibrated Score Disclosed
                    </span>
                    <span className="text-amber-300 font-mono">OOD Guard: Verified Dermoscopic</span>
                  </div>
                </motion.div>
              )}

              {/* SCENE 4: Explainable AI (Views A-H) & U-Net Boundary */}
              {activeChapter.id === 'xai' && (
                <motion.div
                  key="scene-xai"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                  className="relative w-full max-w-lg space-y-3"
                >
                  <AnimatedGestureCursor x="44%" y="12%" label="Switch XAI Layers A–H" />

                  {/* Mini A-H toolbar */}
                  <div className="flex flex-wrap gap-1 p-1.5 rounded-xl bg-slate-900 border border-slate-700 text-[10px] font-bold">
                    {['A·Raw', 'B·CAM', 'C·Overlay', 'D·Contour', 'E·Energy', 'F·Compare', 'G·Clean', 'H·Mask'].map(
                      (tab, idx) => (
                        <motion.span
                          key={tab}
                          animate={{
                            backgroundColor: idx === 2 || idx === 3 ? ['#1e293b', '#2563eb', '#1e293b'] : '#1e293b',
                            color: idx === 2 || idx === 3 ? ['#94a3b8', '#ffffff', '#94a3b8'] : '#94a3b8',
                          }}
                          transition={{ duration: 2.5, delay: idx * 0.25, repeat: Infinity }}
                          className="px-2 py-1 rounded-lg"
                        >
                          {tab}
                        </motion.span>
                      )
                    )}
                  </div>

                  <div className="grid grid-cols-12 gap-3 items-center p-3.5 rounded-2xl bg-slate-900/90 border border-slate-700">
                    {/* Lesion + Grad-CAM + animated U-Net contour */}
                    <div className="col-span-5 relative aspect-square rounded-xl bg-amber-950/60 border border-slate-700 overflow-hidden flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-amber-800/80 blur-[1px]" />
                      {/* Glowing Grad-CAM Heatmap blob */}
                      <motion.div
                        animate={{ opacity: [0.35, 0.85, 0.35], scale: [0.95, 1.08, 0.95] }}
                        transition={{ duration: 2.4, repeat: Infinity }}
                        className="absolute w-14 h-14 rounded-full bg-gradient-to-tr from-red-500/80 via-amber-400/60 to-transparent blur-sm"
                      />
                      {/* Animated U-Net green contour */}
                      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
                        <motion.path
                          d="M25,45 C22,24 48,18 68,28 C84,38 82,66 64,78 C42,88 26,68 25,45 Z"
                          stroke="#10b981"
                          strokeWidth="3"
                          fill="none"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1 }}
                        />
                      </svg>
                    </div>

                    {/* Morphometrics & ABCDE Checklist */}
                    <div className="col-span-7 space-y-2 text-[11px]">
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="p-2 rounded-lg bg-slate-800/90 border border-slate-700">
                          <span className="text-[9px] text-slate-400 block">Energy Inside</span>
                          <span className="font-mono font-bold text-emerald-300">78.4% Focus</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-800/90 border border-slate-700">
                          <span className="text-[9px] text-slate-400 block">Asymmetry</span>
                          <span className="font-mono font-bold text-sky-300">0.19 Balanced</span>
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-800/70 border border-slate-700 space-y-1">
                        <span className="text-[10px] font-bold text-white block">Interactive ABCDE Check</span>
                        <div className="flex items-center gap-1.5">
                          {['A', 'B', 'C', 'D', 'E'].map((letter, idx) => (
                            <motion.span
                              key={letter}
                              animate={{ scale: [1, 1.15, 1] }}
                              transition={{ duration: 1.5, delay: idx * 0.25, repeat: Infinity }}
                              className="w-6 h-6 rounded-md bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center"
                            >
                              {letter}✓
                            </motion.span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* SCENE 5: 6-Agent Clinical Council */}
              {activeChapter.id === 'council' && (
                <motion.div
                  key="scene-council"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                  className="relative w-full max-w-lg space-y-3"
                >
                  <AnimatedGestureCursor x="52%" y="32%" label="Inspect Agent Audit" />

                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Sparkles size={13} className="text-sky-400" />
                      6-Agent Clinical Council Consensus
                    </span>
                    <span className="font-mono font-bold text-emerald-300">94.6% Agreement</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { name: '1. Safety Triage', desc: 'Red-flag check passed' },
                      { name: '2. Vision Specialist', desc: 'EfficientNet-B4 match' },
                      { name: '3. Math Critic', desc: 'ΣP=1.0 & Grad-CAM OK' },
                      { name: '4. Evidence RAG', desc: '3 AAD/BAD cited' },
                      { name: '5. Care Referral', desc: 'Local clinics matched' },
                      { name: '6. Empathy Agent', desc: 'Plain-language guide' },
                    ].map((agent, idx) => (
                      <motion.div
                        key={agent.name}
                        initial={{ opacity: 0.4, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1, borderColor: ['rgba(51,65,85,0.8)', 'rgba(56,189,248,0.8)', 'rgba(16,185,129,0.7)'] }}
                        transition={{ duration: 2.2, delay: idx * 0.25, repeat: Infinity }}
                        className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-sky-300">{agent.name}</span>
                          <CheckCircle2 size={11} className="text-emerald-400" />
                        </div>
                        <p className="text-[10px] text-slate-300 leading-tight">{agent.desc}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* SCENE 6: Grounded RAG Chat & Interactive Citations */}
              {activeChapter.id === 'ragchat' && (
                <motion.div
                  key="scene-ragchat"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                  className="relative w-full max-w-lg p-4 rounded-2xl bg-slate-900/95 border border-slate-700 space-y-2.5"
                >
                  <AnimatedGestureCursor x="64%" y="56%" label="Click [CIT-1] Source" />

                  <div className="flex justify-end">
                    <div className="px-3 py-1.5 rounded-2xl rounded-tr-none bg-blue-600 text-white text-xs font-medium">
                      What did the AI find &amp; what should I ask my doctor?
                    </div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.3 }}
                    className="p-3 rounded-2xl rounded-tl-none bg-slate-800/90 border border-slate-700 space-y-1.5 text-xs text-slate-200"
                  >
                    <div className="flex items-center justify-between border-b border-slate-700 pb-1">
                      <span className="font-bold text-white">## What the AI Found</span>
                      <span className="text-[10px] font-mono text-emerald-400">1.6s • Fast RAG</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Visual features match a <strong className="text-white">Common Mole</strong>. Grounded in AAD Clinical Practice Guidelines{' '}
                      <motion.span
                        animate={{ scale: [1, 1.12, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-sky-500/25 text-sky-300 font-bold border border-sky-400/50 text-[10px]"
                      >
                        [CIT-1]
                      </motion.span>
                    </p>
                    <div className="p-2 rounded-lg bg-slate-950/70 border border-sky-500/30 text-[10px] text-sky-200">
                      📖 <strong>JAAD 2023 Source Modal:</strong> Peer-reviewed guideline excerpt opens in 1 click!
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* SCENE 7: Care Connect, PDF Export & History Comparison */}
              {activeChapter.id === 'care' && (
                <motion.div
                  key="scene-care"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                  className="relative w-full max-w-lg grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  <AnimatedGestureCursor x="72%" y="30%" label="Book Verified Clinic" />

                  <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white flex items-center gap-1">
                        <Building2 size={12} className="text-sky-400" /> Care Connect PIN Lookup
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">110029</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1 text-[10px]">
                      <span className="font-bold text-emerald-300 block">AIIMS Dermatology OPD ✓</span>
                      <span className="text-slate-300 block">Zero fabricated providers • Status tracked</span>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-lg bg-sky-600 text-white text-[10px] font-bold text-center">
                      Request Consultation Slot →
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-700 space-y-2">
                    <span className="text-[11px] font-bold text-white flex items-center gap-1">
                      <Download size={12} className="text-emerald-400" /> PDF Report &amp; Evolution
                    </span>
                    <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between text-[10px]">
                      <span className="text-slate-200 flex items-center gap-1">
                        <FileText size={11} className="text-sky-400" /> Clinical PDF Export
                      </span>
                      <span className="text-emerald-400 font-bold">Ready</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between text-[10px]">
                      <span className="text-slate-200 flex items-center gap-1">
                        <GitCompare size={11} className="text-amber-400" /> Compare 2 Scans
                      </span>
                      <span className="text-sky-300 font-bold">Track Size</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Video Subtitle & Interactive Scrubber Bar */}
          <div className="bg-slate-900/95 border-t border-slate-800 px-4 py-3 space-y-2.5">
            {/* Step Progress Scrubber Bars */}
            <div className="grid grid-cols-7 gap-1.5" role="tablist" aria-label="Demo Video Chapters">
              {DEMO_CHAPTERS.map((chap, idx) => {
                const isPast = idx < activeIndex
                const isCurrent = idx === activeIndex
                return (
                  <button
                    key={chap.id}
                    type="button"
                    onClick={() => selectChapter(idx)}
                    aria-label={`Jump to Step ${chap.stepNumber}: ${chap.title}`}
                    className="group relative h-2 rounded-full bg-slate-800 overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-400"
                    title={`${chap.stepNumber}. ${chap.shortLabel}`}
                  >
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-100"
                      style={{
                        width: isPast ? '100%' : isCurrent ? `${Math.max(progressPct, 6)}%` : '0%',
                      }}
                    />
                  </button>
                )
              })}
            </div>

            {/* Subtitle Caption Row */}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-200 leading-snug">
                <span className="font-bold text-sky-400 mr-1.5">[{activeChapter.stepNumber}]</span>
                {activeChapter.narration}
              </p>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => selectChapter((activeIndex - 1 + DEMO_CHAPTERS.length) % DEMO_CHAPTERS.length)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                  aria-label="Previous step"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => selectChapter((activeIndex + 1) % DEMO_CHAPTERS.length)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                  aria-label="Next step"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Step-by-Step Interactive Guide & Feature Checklist (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          {/* Active Step Instructions Card */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                Step {activeChapter.stepNumber} • Guide &amp; Details
              </span>
              <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                <Clock size={11} /> {activeChapter.durationLabel}
              </span>
            </div>

            <h4 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
              {activeChapter.title}
            </h4>

            <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                How to Use This Step
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                {activeChapter.howToUse}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                Under the Hood &amp; Feature Details
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                {activeChapter.detailedFeatureNote}
              </p>
            </div>
          </div>

          {/* Clickable 7-Step Chapter Selector List */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              All 7 Walkthrough Chapters (Click to Jump):
            </span>
            <div className="grid grid-cols-1 gap-1.5 max-h-[210px] overflow-y-auto pr-1 scrollbar-thin">
              {DEMO_CHAPTERS.map((chap, idx) => {
                const active = idx === activeIndex
                return (
                  <button
                    key={chap.id}
                    type="button"
                    onClick={() => selectChapter(idx)}
                    className={`w-full text-left px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      active
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs font-bold'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className={`w-5 h-5 rounded-md text-[10px] font-mono font-bold flex items-center justify-center shrink-0 ${
                          active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {chap.stepNumber}
                      </span>
                      <span className="truncate">{chap.shortLabel}</span>
                    </span>
                    <span className={`text-[10px] font-mono shrink-0 ${active ? 'text-sky-100' : 'text-slate-400'}`}>
                      {chap.durationLabel.split('–')[0].trim()}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Direct Launch Action CTA */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleLaunchFeature}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <span>{activeChapter.actionLabel}</span>
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                selectChapter(0)
                setIsPlaying(true)
              }}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              title="Restart Walkthrough from Step 01"
              aria-label="Restart Walkthrough"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
