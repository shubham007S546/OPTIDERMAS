'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  ChevronRight,
  Clock,
  FileText,
  Layers,
  Maximize2,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { NavigationDestination } from './clinical-sidebar'

interface WalkthroughChapter {
  id: string
  stepNumber: string
  shortLabel: string
  title: string
  startSec: number
  endSec: number
  howToUse: string
  underTheHood: string
  narration: string
  ctaLabel: string
  dest?: NavigationDestination
  action?: 'care-connect'
  icon: typeof Play
}

const CHAPTERS: WalkthroughChapter[] = [
  {
    id: 'modes',
    stepNumber: '01',
    shortLabel: 'Modes & Privacy',
    title: 'Dual Modes & Private SQLite Vault',
    startSec: 0,
    endSec: 6,
    howToUse: 'Switch between "For Patients" (plain everyday English) and "Clinician View" (deep telemetry) at the top of any screen.',
    underTheHood: 'OptiDerma sends uncompressed dermoscopy bytes directly to PyTorch, persists cases in local SQLite WAL, and wakes the AI server on load.',
    narration: 'Step one: Switch between For Patients plain-language guidance and Clinician View telemetry. Your skin photos remain private.',
    ctaLabel: 'Open Privacy & Diagnostics',
    dest: 'status',
    icon: ShieldCheck,
  },
  {
    id: 'upload',
    stepNumber: '02',
    shortLabel: 'Upload & Clean',
    title: 'Dermoscopy Upload & DullRazor Cleaning',
    startSec: 6,
    endSec: 12,
    howToUse: 'Open New Skin Analysis and drop any close-up JPG, PNG, or WEBP skin lesion photo into the dropzone.',
    underTheHood: 'Multi-directional Black-Hat morphology detects intersecting hairs and inpaints them cleanly via OpenCV Telea while preserving lesion margins.',
    narration: 'Step two: Upload a clear close-up skin photo. DullRazor removes overlying hair strands without disturbing lesion borders.',
    ctaLabel: 'Upload Skin Photo',
    dest: 'analyze',
    icon: Camera,
  },
  {
    id: 'ai',
    stepNumber: '03',
    shortLabel: 'AI Triage',
    title: 'PyTorch Multi-Task & Adaptive Triage',
    startSec: 12,
    endSec: 18,
    howToUse: 'Inspect your Patient Care Summary first, or open Adaptive Differential to compare top 7-class HAM10000 scores.',
    underTheHood: 'EfficientNet-B4 scores 7 classes in parallel with U-Net segmentation. When margin exceeds 20%, a single dominant match prevents ambiguity.',
    narration: 'Step three: The multi-task neural network computes 7-class probabilities and applies adaptive clinical triage.',
    ctaLabel: 'Run Skin Analysis',
    dest: 'analyze',
    icon: Activity,
  },
  {
    id: 'xai',
    stepNumber: '04',
    shortLabel: 'XAI Studio A–H',
    title: 'Explainable AI Views A–H & Morphometrics',
    startSec: 18,
    endSec: 24,
    howToUse: 'Switch between Raw (A), Raw CAM (B), Overlay (C), Boundary (D), Energy (E), Class Compare (F), De-Haired (G), and Hair Mask (H).',
    underTheHood: 'U-Net computes area, perimeter, asymmetry index, and isoperimetric compactness while Grad-CAM verifies saliency inside the spot.',
    narration: 'Step four: Inspect explainable AI Views A through H, U-Net lesion boundaries, morphometric metrics, and Grad-CAM focus.',
    ctaLabel: 'Try XAI Studio',
    dest: 'analyze',
    icon: Layers,
  },
  {
    id: 'council',
    stepNumber: '05',
    shortLabel: '6-Agent Council',
    title: 'Multi-Agent Clinical Council Deliberation',
    startSec: 24,
    endSec: 30,
    howToUse: 'Open Multi-Agent Council after scanning a spot to inspect Triage, Vision, Critic, Evidence, Care, and Communication agents.',
    underTheHood: 'All 6 specialized agents execute independent mathematical invariant, safety red-flag, and literature cross-checks.',
    narration: 'Step five: Review the 6-agent clinical council as safety, vision, verification, literature, care, and patient advocates converge.',
    ctaLabel: 'Open Multi-Agent Council',
    dest: 'council',
    icon: Sparkles,
  },
  {
    id: 'rag',
    stepNumber: '06',
    shortLabel: 'RAG AI Chat',
    title: '10x Grounded Dermatology RAG Chat',
    startSec: 30,
    endSec: 36,
    howToUse: 'Ask follow-up questions in plain English or click a Clinical Mode prompt for structured tables and interactive [CIT-X] citations.',
    underTheHood: 'Hybrid BM25 retrieval across 48+ international guidelines with fast grounded synthesis renders clean tables, headings, and source drawers.',
    narration: 'Step six: Ask any follow-up question in Grounded RAG Chat for instant structured answers with verified clinical citations.',
    ctaLabel: 'Launch RAG AI Chat',
    dest: 'consult-chat',
    icon: MessageSquare,
  },
  {
    id: 'care',
    stepNumber: '07',
    shortLabel: 'PDF & Care Connect',
    title: 'Direct PDF Reports, Care Connect & History',
    startSec: 36,
    endSec: 42,
    howToUse: 'Download direct PDF Clinical Reports or Patient Handouts, book dermatologists with downloadable PDF slips, and compare 2 scans in History.',
    underTheHood: 'Server-side ReportLab PDFs with embedded figures plus instant binary PDF handouts, .ics calendar exports, and SQLite longitudinal tracking.',
    narration: 'Step seven: Download real clinical PDF reports, book verified dermatologists with appointment slips, and compare scans over time.',
    ctaLabel: 'Find Dermatologists',
    action: 'care-connect',
    icon: FileText,
  },
]

const TOTAL_DURATION = 42.0

interface ProjectDemoVideoProps {
  onNavigate: (dest: NavigationDestination) => void
  onOpenCareConnect: () => void
}

export function ProjectDemoVideo({ onNavigate, onOpenCareConnect }: ProjectDemoVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(TOTAL_DURATION)
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5>(1)
  const [isMuted, setIsMuted] = useState(false)

  const activeIndex = Math.min(
    CHAPTERS.length - 1,
    Math.max(
      0,
      CHAPTERS.findIndex((c, idx) =>
        idx === CHAPTERS.length - 1
          ? currentTime >= c.startSec
          : currentTime >= c.startSec && currentTime < c.endSec
      )
    )
  )
  const chapter = CHAPTERS[activeIndex] || CHAPTERS[0]
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      if (v.currentTime >= (v.duration || TOTAL_DURATION) - 0.15) {
        v.currentTime = 0
      }
      v.muted = isMuted
      v.playbackRate = playbackRate
      v.play().catch(() => {})
    } else {
      v.pause()
    }
  }

  const jumpToChapter = (ch: WalkthroughChapter, autoPlay = true) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = ch.startSec + 0.05
    setCurrentTime(ch.startSec + 0.05)
    if (autoPlay) {
      v.muted = isMuted
      v.playbackRate = playbackRate
      v.play().catch(() => {})
    }
  }

  const toggleSpeed = () => {
    const next: 1 | 1.5 = playbackRate === 1 ? 1.5 : 1
    setPlaybackRate(next)
    if (videoRef.current) {
      videoRef.current.playbackRate = next
    }
  }

  const toggleMute = () => {
    const next = !isMuted
    setIsMuted(next)
    if (videoRef.current) {
      videoRef.current.muted = next
    }
  }

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      el.requestFullscreen?.().catch(() => {})
    }
  }

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current
    if (!v) return
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width)))
    const targetSec = frac * (v.duration || TOTAL_DURATION)
    v.currentTime = targetSec
    setCurrentTime(targetSec)
  }

  const formatTime = (sec: number) => {
    const s = Math.max(0, Math.floor(sec))
    const m = Math.floor(s / 60)
    const rem = s % 60
    return `${m}:${String(rem).padStart(2, '0')}`
  }

  return (
    <section
      aria-label="OptiDerma Animated Platform Walkthrough"
      className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8 shadow-xs space-y-5"
    >
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200">
            <Play size={12} className="fill-blue-700 text-blue-700" />
            <span>HD Animated Project Walkthrough (7 Steps · {formatTime(duration)})</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            How OptiDerma Works — Complete Visual Feature Tour
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
            Watch the full 7-step animated walkthrough from skin photo upload &amp; DullRazor artifact cleaning to XAI Views A–H, Multi-Agent Council, Grounded RAG, and direct PDF downloads.
          </p>
        </div>

        {/* Player Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={togglePlay}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition-colors"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} className="fill-white" />}
            <span>{isPlaying ? 'Pause Video' : currentTime > 0.5 ? 'Resume Video' : 'Play Walkthrough'}</span>
          </button>

          <button
            type="button"
            onClick={toggleSpeed}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-mono font-bold transition-colors"
            title="Toggle playback speed"
          >
            <Clock size={13} />
            <span>{playbackRate}x</span>
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
              !isMuted
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
            }`}
            title="Toggle walkthrough voiceover audio"
          >
            {!isMuted ? <Volume2 size={14} className="text-emerald-600" /> : <VolumeX size={14} />}
            <span className="hidden sm:inline">{!isMuted ? 'Voice On' : 'Muted'}</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Fullscreen Walkthrough"
            aria-label="Fullscreen Walkthrough"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Main Layout: 16:9 Cinema Video Player + Interactive Step Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Crisp 16:9 Animated MP4 Video Viewport */}
        <div
          ref={containerRef}
          className="lg:col-span-8 flex flex-col rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 shadow-lg"
        >
          <div className="relative aspect-video w-full bg-slate-950 group">
            <video
              ref={videoRef}
              src="/videos/optiderma-demo.mp4"
              poster="/videos/optiderma-poster.png"
              playsInline
              muted={isMuted}
              preload="metadata"
              onClick={togglePlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onLoadedMetadata={(e) => {
                const dur = e.currentTarget.duration
                if (Number.isFinite(dur) && dur > 0) setDuration(dur)
              }}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              className="w-full h-full object-contain cursor-pointer"
            />

            {/* Clean Center Play Trigger Overlay when Paused */}
            {!isPlaying && (
              <button
                type="button"
                onClick={togglePlay}
                aria-label="Play walkthrough video"
                className="absolute inset-0 flex items-center justify-center bg-slate-950/25 hover:bg-slate-950/15 transition-colors group"
              >
                <span className="size-16 rounded-full bg-blue-600/95 hover:bg-blue-500 text-white shadow-2xl flex items-center justify-center ring-4 ring-white/25 transition-transform group-hover:scale-105">
                  <Play size={26} className="fill-white ml-1" />
                </span>
              </button>
            )}
          </div>

          {/* Interactive Timeline & Chapter Scrubber Bar */}
          <div className="bg-slate-900 border-t border-slate-800 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-[10px]">
                  STEP {chapter.stepNumber} / 07
                </span>
                <span className="font-sans font-semibold text-white truncate">{chapter.title}</span>
              </div>
              <span>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div
              onClick={handleScrub}
              role="slider"
              aria-label="Walkthrough video progress"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={Math.round(currentTime)}
              tabIndex={0}
              className="relative h-2.5 rounded-full bg-slate-800 cursor-pointer overflow-hidden group"
            >
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-blue-500 transition-[width] duration-150 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
              {CHAPTERS.slice(1).map((c) => (
                <span
                  key={c.id}
                  style={{ left: `${(c.startSec / duration) * 100}%` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-950/70"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Synchronized Step Guide & Direct Feature Launcher */}
        <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                STEP {chapter.stepNumber} · DETAILS
              </span>
              <span className="font-mono text-slate-500">
                {formatTime(chapter.startSec)} – {formatTime(chapter.endSec)}
              </span>
            </div>

            <h4 className="text-base font-black text-slate-900 leading-snug">{chapter.title}</h4>

            <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                How to Use
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">{chapter.howToUse}</p>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 block">
                Feature Architecture
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">{chapter.underTheHood}</p>
            </div>
          </div>

          {/* Clickable 7-Chapter Jump List */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Jump to Chapter:
            </span>
            <div className="space-y-1">
              {CHAPTERS.map((ch, idx) => {
                const Icon = ch.icon
                const isAct = idx === activeIndex
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => jumpToChapter(ch, true)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-all ${
                      isAct
                        ? 'bg-blue-700 text-white font-bold shadow-2xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/70'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Icon size={12} className={isAct ? 'text-sky-200 shrink-0' : 'text-blue-600 shrink-0'} />
                      <span className="truncate">{ch.stepNumber} · {ch.shortLabel}</span>
                    </span>
                    <span className={`font-mono text-[10px] ${isAct ? 'text-blue-100' : 'text-slate-400'}`}>
                      {formatTime(ch.startSec)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Launch Feature Action */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                if (chapter.action === 'care-connect') onOpenCareConnect()
                else if (chapter.dest) onNavigate(chapter.dest)
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <span>{chapter.ctaLabel}</span>
              <ArrowRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => jumpToChapter(CHAPTERS[0], true)}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors"
              title="Restart walkthrough"
              aria-label="Restart walkthrough"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Icon Feature Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <BookOpen size={13} className="text-blue-600" />
            48+ Grounded Guidelines
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <CalendarDays size={13} className="text-emerald-600" />
            Direct PDF Reports &amp; Slips
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <ChevronRight size={13} className="text-sky-600" />
            Click any chapter above to jump straight to that step
          </span>
        </div>
      </div>
    </section>
  )
}
