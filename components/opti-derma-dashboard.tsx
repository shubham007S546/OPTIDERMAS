'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Camera,
  Clock,
  FileText,
  Menu,
  MessageCircle,
  Mic,
  Moon,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from 'lucide-react'

import { predictLesion, OptiDermaApiError, getMockPrediction } from '@/lib/api'
import { LESION_LABELS, type PredictResponse } from '@/lib/types'
import type { BookingConfirmation } from '@/lib/booking'
import { BookingDialog, type BookingPrefill } from './booking-dialog'
import { ResultsView } from './results-view'
import { UploadZone } from './upload-zone'
import { VoiceAssistant, type VoiceBookingHandlers } from './voice-assistant'
import { ErrorBoundary } from './error-boundary'

// The offline sample button fabricates a result, so it is only offered during development
const ALLOW_SAMPLE_RESPONSE = process.env.NODE_ENV !== 'production'

const NeuralBrain = dynamic(
  () => import('@/components/neural-brain').then((module) => module.NeuralBrain),
  { ssr: false, loading: () => <div className="neural-placeholder" /> }
)

type View = 'home' | 'analyze' | 'consultation' | 'monitor'
type AnalysisStage = 'idle' | 'ready' | 'uploading' | 'analysing' | 'result' | 'error'

export default function OptiDermaDashboard({
  referenceImageUrl = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-CKeGCEwIEShZTlhO6iv1sh2nboVW2o.png',
}: {
  referenceImageUrl?: string
}) {
  const [view, setView] = useState<View>('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  // Upload and Analysis state
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [stage, setStage] = useState<AnalysisStage>('idle')
  const [result, setResult] = useState<PredictResponse | null>(null)
  const [error, setError] = useState<OptiDermaApiError | Error | null>(null)
  const [wakeupNotice, setWakeupNotice] = useState<string | null>(null)

  // Booking dialog state (kept stable so the dialog form is not reset by unrelated re-renders)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [bookingPrefill, setBookingPrefill] = useState<BookingPrefill | undefined>(undefined)
  const [bookingConfirmation, setBookingConfirmation] = useState<BookingConfirmation | null>(null)

  const openBooking = useCallback((prefill?: BookingPrefill) => {
    setBookingPrefill(prefill)
    setBookingConfirmation(null)
    setBookingOpen(true)
    setMenuOpen(false)
  }, [])
  const closeBooking = useCallback(() => setBookingOpen(false), [])
  const handleAgentBooked = useCallback((booking: BookingConfirmation) => {
    setBookingPrefill(undefined)
    setBookingConfirmation(booking)
    setBookingOpen(true)
  }, [])
  const voiceBooking: VoiceBookingHandlers = {
    onOpenBooking: openBooking,
    onAgentBooked: handleAgentBooked,
  }

  // Revoke object URL on cleanup
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [preview])

  // Select file WITHOUT resizing, cropping, or compressing
  const handleFileSelect = (selectedFile: File) => {
    if (preview) {
      URL.revokeObjectURL(preview)
    }

    const objectUrl = URL.createObjectURL(selectedFile)
    setFile(selectedFile)
    setPreview(objectUrl)
    setResult(null)
    setError(null)
    setWakeupNotice(null)
    setStage('ready')
    setView('analyze')
    setMenuOpen(false)
  }

  // Clear everything: strictly no persistence
  const clearEverything = () => {
    if (preview) {
      URL.revokeObjectURL(preview)
    }
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
    setWakeupNotice(null)
    setStage('idle')
  }

  // Execute inference pipeline
  const runAnalysis = async (force = false) => {
    if (!file || stage === 'uploading' || stage === 'analysing') return

    setError(null)
    setWakeupNotice(null)
    setStage('uploading')

    try {
      const response = await predictLesion(file, {
        force,
        onWakeup: (msg) => setWakeupNotice(msg),
        onProgress: (stg) => setStage(stg),
      })
      setResult(response)
      setStage('result')
      setWakeupNotice(null)
    } catch (err: unknown) {
      setWakeupNotice(null)
      setStage('error')
      if (err instanceof OptiDermaApiError || err instanceof Error) {
        setError(err)
      } else {
        setError(new Error(String(err)))
      }
    }
  }

  // Fallback to offline mock for testing if backend is offline
  const handleUseMockFallback = () => {
    const mock = getMockPrediction(file?.name || 'sample.jpg')
    setResult(mock)
    setError(null)
    setWakeupNotice(null)
    setStage('result')
  }

  function navigate(next: View) {
    setView(next)
    setMenuOpen(false)
  }

  return (
    <ErrorBoundary fallbackTitle="OptiDerma Dashboard Fault">
      <main className={`site-shell theme-${theme}`}>
        {/* Primary Navigation Header */}
        <header className="site-nav">
          <button className="wordmark" onClick={() => navigate('home')} aria-label="OptiDerma home">
            <span className="wordmark-mark">O</span>
            <span>OPTIDERMA</span>
          </button>
          <nav className="desktop-links" aria-label="Main navigation">
            <button onClick={() => navigate('analyze')}>Analyze</button>
            <button onClick={() => navigate('consultation')}>Consult</button>
            <button onClick={() => navigate('monitor')}>Monitor & AI Notes</button>
          </nav>
          <div className="nav-actions">
            <button
              className="theme-button"
              type="button"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button
              className="nav-cta"
              type="button"
              onClick={() => openBooking()}
              title="Book a tele-consultation session"
            >
              <CalendarDays size={15} className="mr-1.5 inline-block align-[-2px]" />
              Book a session
            </button>
            <button
              className="menu-button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
            >
              <Menu size={20} />
            </button>
          </div>
        </header>

        {/* Mobile Navigation Dropdown */}
        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              id="mobile-navigation"
              aria-label="Mobile navigation"
              className="mobile-menu"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {[
                ['home', 'Home'],
                ['analyze', 'Check my skin'],
                ['consultation', 'Voice Assistant'],
                ['monitor', 'Monitor & AI Notes'],
              ].map(([key, label]) => (
                <button key={key} onClick={() => navigate(key as View)}>
                  {label}
                  <ArrowRight size={15} />
                </button>
              ))}
              <button onClick={() => openBooking()}>
                Book a session
                <CalendarDays size={15} />
              </button>
            </motion.nav>
          )}
        </AnimatePresence>

        {/* View Router */}
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28 }}
          >
            {view === 'home' && (
              <Home
                navigate={navigate}
                onFileSelect={handleFileSelect}
                referenceImageUrl={referenceImageUrl}
              />
            )}
            {view === 'analyze' && (
              <Analyze
                file={file}
                preview={preview}
                stage={stage}
                result={result}
                error={error}
                wakeupNotice={wakeupNotice}
                onFileSelect={handleFileSelect}
                onRun={() => runAnalysis(false)}
                onRunForced={() => runAnalysis(true)}
                onReset={clearEverything}
                onUseMock={handleUseMockFallback}
                onConsult={() => navigate('consultation')}
                onBook={() => openBooking()}
              />
            )}
            {view === 'consultation' && (
              <Consultation currentResult={result} navigate={navigate} booking={voiceBooking} />
            )}
            {view === 'monitor' && <Monitor currentResult={result} navigate={navigate} onBook={() => openBooking()} />}
          </motion.div>
        </AnimatePresence>

        <BookingDialog
          open={bookingOpen}
          prefill={bookingPrefill}
          confirmation={bookingConfirmation}
          onClose={closeBooking}
          onBooked={() => {}}
        />
      </main>
    </ErrorBoundary>
  )
}


function Home({
  navigate,
  onFileSelect,
  referenceImageUrl,
}: {
  navigate: (view: View) => void
  onFileSelect: (file: File) => void
  referenceImageUrl: string
}) {
  return (
    <>
      <section className="hero editorial-section">
        <div className="hero-copy">
          <p className="eyebrow">AI-assisted skin health</p>
          <h1>
            Understand your skin.
            <br />
            <em>See what the AI sees.</em>
          </h1>
          <p className="hero-sub">
            Upload a dermoscopy image of a skin concern to examine multi-class differential predictions,
            segmentation boundaries, and morphological measurements.
          </p>
          <div className="hero-actions">
            <button className="button-primary" onClick={() => navigate('analyze')}>
              Check my skin <ArrowRight size={17} />
            </button>
            <button className="button-secondary" onClick={() => navigate('consultation')}>
              <Mic size={16} />
              Voice Assistant
            </button>
          </div>
          <p className="safety">
            <ShieldCheck size={15} /> AI decision support · Not a clinical diagnosis
          </p>
        </div>
        <div className="hero-engine">
          <div className="console-grid" />
          <div className="console-vignette" />
          <NeuralBrain state="active" className="hero-brain-3d" />
          <div className="engine-readout">
            <span className="status-dot" /> Live 3D inference <b>01</b>
          </div>
          <div className="engine-callout">
            <Sparkles size={15} />
            <span>
              Explainable AI
              <br />
              <b>evidence, not guesses</b>
            </span>
          </div>
          <div className="console-stage-list">
            <span className="is-active">
              01 <b>Image upload</b>
            </span>
            <span>
              02 <b>Original bytes</b>
            </span>
            <span>
              03 <b>Inference</b>
            </span>
            <span>
              04 <b>Differential</b>
            </span>
          </div>
        </div>
      </section>

      {/* Upload Callout Section */}
      <section className="upload-section editorial-section">
        <div>
          <p className="eyebrow">01 / Check your skin</p>
          <h2>
            Start with what
            <br />
            <em>you can see.</em>
          </h2>
          <p className="section-copy">
            Provide a dermoscopy image. Preprocessing happens exclusively on the inference server,
            ensuring the deep learning model sees the exact, uncompressed image bytes.
          </p>
          <button className="text-link" onClick={() => navigate('analyze')}>
            Go to analysis workspace <ArrowRight size={16} />
          </button>
        </div>
        <UploadZone onFileSelect={onFileSelect} />
      </section>

      {/* 4-Step Process */}
      <section className="steps-section editorial-section">
        <div className="section-topline">
          <p className="eyebrow">02 / From photo to understanding</p>
          <p>One transparent workflow from skin concern to actionable insights.</p>
        </div>
        <div className="steps-row">
          {[
            ['01', 'Photo', 'Add a clear dermoscopy image.'],
            ['02', 'Analysis', 'Server model computes 7-class differential.'],
            ['03', 'Explanation', 'Inspect segmentation boundaries and risk.'],
            ['04', 'Consultation', 'Speak with the ElevenLabs voice assistant.'],
          ].map(([n, t, d]) => (
            <div className="step" key={n}>
              <span>{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Evidence Banner */}
      <section className="evidence-section editorial-section">
        <div className="evidence-copy">
          <p className="eyebrow">03 / See what the AI sees</p>
          <h2>
            Evidence before
            <br />
            <em>assumptions.</em>
          </h2>
          <p className="section-copy">
            Inspect differential predictions, asymmetry indices, and boundary localization maps.
            Every output is traceable to the connected backend model.
          </p>
          <button className="text-link" onClick={() => navigate('analyze')}>
            Explore analysis <ArrowRight size={16} />
          </button>
        </div>
        <div className="evidence-visual">
          <div className="evidence-placeholder">
            <NeuralBrain state="idle" className="evidence-brain" />
            <span>Live Evidence Canvas</span>
            <b>Upload an image to populate this view</b>
          </div>
        </div>
      </section>

      {/* Voice Assistant CTA */}
      <section className="consult-cta editorial-section">
        <div>
          <p className="eyebrow">04 / Talk to OptiDerma</p>
          <h2>
            Have a question
            <br />
            <em>about what you notice?</em>
          </h2>
        </div>
        <button className="button-primary" onClick={() => navigate('consultation')}>
          Voice Assistant <ArrowRight size={17} />
        </button>
      </section>

      {/* Footer strictly adhering to zero data tracking */}
      <footer>
        <span className="wordmark">
          <span className="wordmark-mark">O</span>
          <span>OPTIDERMA</span>
        </span>
        <span>Private by design · No image retention</span>
        <span>Decision Support System</span>
      </footer>
    </>
  )
}

function Analyze({
  file,
  preview,
  stage,
  result,
  error,
  wakeupNotice,
  onFileSelect,
  onRun,
  onRunForced,
  onReset,
  onUseMock,
  onConsult,
  onBook,
}: {
  file: File | null
  preview: string | null
  stage: AnalysisStage
  result: PredictResponse | null
  error: OptiDermaApiError | Error | null
  wakeupNotice: string | null
  onFileSelect: (f: File) => void
  onRun: () => void
  onRunForced: () => void
  onReset: () => void
  onUseMock: () => void
  onConsult: () => void
  onBook: () => void
}) {
  const isProcessing = stage === 'uploading' || stage === 'analysing'

  return (
    <section className="app-view editorial-section">
      <div className="view-heading">
        <p className="eyebrow">Check your skin</p>
        <h1>See what the AI sees.</h1>
        <p>
          Upload a clear dermoscopy image. The original bytes are preserved and streamed directly to
          the inference engine. Annotations and risk levels appear only when returned by the model backend.
        </p>
      </div>

      {/* Wakeup notice banner if backend takes > 5 seconds */}
      {wakeupNotice && (
        <div
          role="status"
          className="mt-6 flex items-center gap-3 p-4 rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-200 text-xs"
        >
          <Clock className="size-4 animate-spin text-sky-600 dark:text-sky-400 shrink-0" />
          <span>{wakeupNotice}</span>
        </div>
      )}

      {/* Error state with retry controls */}
      {stage === 'error' && error && (
        <div
          role="alert"
          className="mt-6 p-5 rounded-2xl border border-red-500/40 bg-red-500/10 text-foreground space-y-3"
        >
          <div className="flex items-center gap-2.5 font-bold text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="size-5 shrink-0 text-red-600 dark:text-red-400" />
            <span>Analysis Request Failed</span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{error.message}</p>
          {'detail' in error && error.detail && (
            <pre className="p-3 rounded-lg bg-black/10 dark:bg-black/40 text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
              {String(error.detail)}
            </pre>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {error instanceof OptiDermaApiError && error.qualityRejected ? (
              <button
                type="button"
                onClick={onRunForced}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="size-3.5" />
                Analyse anyway
              </button>
            ) : (
              <button
                type="button"
                onClick={onRun}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="size-3.5" />
                Retry Analysis
              </button>
            )}
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted transition-colors"
            >
              <RotateCcw className="size-3.5" />
              Analyse another image
            </button>
            {ALLOW_SAMPLE_RESPONSE && (
              <button
                type="button"
                onClick={onUseMock}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/80 bg-muted/40 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors ml-auto"
                title="Development only: renders a fabricated sample response, NOT a real analysis"
              >
                <Sparkles className="size-3 text-primary" />
                Dev: load fabricated sample (not a real result)
              </button>
            )}
          </div>
        </div>
      )}

      {/* If result is ready, show rich ResultsView */}
      {stage === 'result' && result && preview ? (
        <div className="mt-8">
          <ResultsView
            previewUrl={preview}
            result={result}
            onReset={onReset}
            onConsult={onConsult}
            onBook={onBook}
          />
        </div>
      ) : (
        /* Workspace when preparing or running */
        <div className="analysis-workspace mt-8">
          {/* Left panel: Upload or Image Preview */}
          <div className="analysis-image">
            <div className="workspace-label">
              IMAGE EVIDENCE{' '}
              <span>{isProcessing ? 'STREAMING BYTES' : file ? 'READY FOR INFERENCE' : 'AWAITING UPLOAD'}</span>
            </div>

            {preview && file ? (
              <div className={`uploaded-image ${isProcessing ? 'is-scanning' : ''}`}>
                <img src={preview} alt="Selected skin lesion for analysis" />
                {isProcessing && <span className="scan-line" aria-hidden="true" />}
                <button
                  onClick={onReset}
                  disabled={isProcessing}
                  aria-label="Remove uploaded image and clear memory"
                  className="disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="py-4">
                <UploadZone onFileSelect={onFileSelect} />
              </div>
            )}

            {file && stage === 'ready' && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-card/60">
                <div className="text-xs">
                  <span className="font-semibold block text-foreground">{file.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB · Original raw bytes
                  </span>
                </div>
                <button
                  type="button"
                  className="button-primary run-button"
                  onClick={onRun}
                  disabled={isProcessing}
                >
                  Run analysis <ArrowRight size={16} />
                </button>
              </div>
            )}

            {isProcessing && (
              <div className="mt-4 p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-center gap-3 text-xs">
                <RefreshCw className="size-4 animate-spin text-primary" />
                <span>
                  {stage === 'uploading'
                    ? 'Streaming original bytes to model server…'
                    : 'Deep learning model computing differential predictions…'}
                </span>
              </div>
            )}
          </div>

          {/* Right panel: 3D Metaphor */}
          <div className="analysis-brain-panel">
            <div className="workspace-label">
              EXPLAINABILITY <span>{isProcessing ? 'PROCESSING' : 'REASONING METAPHOR'}</span>
            </div>
            <NeuralBrain state={isProcessing ? 'active' : 'idle'} className="analysis-brain" />
            <p>
              {isProcessing
                ? 'The model is evaluating multi-class logits, segmentation maps, and morphological metrics.'
                : "A visual metaphor for the model's connected reasoning — not a diagnostic output."}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

function Consultation({
  currentResult,
  navigate,
  booking,
}: {
  currentResult: PredictResponse | null
  navigate: (view: View) => void
  booking: VoiceBookingHandlers
}) {
  return (
    <section className="app-view editorial-section">
      <div className="view-heading">
        <p className="eyebrow">Talk to OptiDerma</p>
        <h1>A calmer way to ask.</h1>
        <p>
          Converse live with an AI clinical consultation assistant powered by ElevenLabs.
          The assistant receives textual summaries of top predictions and morphological measurements —
          no raw images are ever passed to the voice model.
        </p>
      </div>

      <div className="consultation-grid mt-8">
        {/* Left: 3D Visualization */}
        <div className="consult-visual">
          <NeuralBrain state="active" className="consult-brain" />
          <div className="voice-core is-listening">
            <MessageCircle size={19} />
            <span>Voice Core Ready</span>
          </div>
        </div>

        {/* Right: ElevenLabs Assistant */}
        <div className="consult-copy">
          {currentResult ? (
            <div className="mb-4 p-3.5 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-foreground">
                  Image Context Attached: {LESION_LABELS[currentResult.top3[0][0]]?.title || currentResult.top3[0][0].toUpperCase()}
                </span>
                <p className="text-muted-foreground text-[11px]">
                  Risk level: <strong className="text-foreground">{currentResult.risk.level}</strong> ({currentResult.risk.recommendation})
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('analyze')}
                className="text-primary hover:underline font-semibold text-xs ml-3 shrink-0"
              >
                View Findings →
              </button>
            </div>
          ) : (
            <div className="mb-4 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
              <div>
                <span className="font-bold">General Consultation Mode</span>
                <p className="text-[11px] opacity-80">
                  No image analyzed yet. OptiDerma will answer general questions, or you can analyze a skin photo first.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('analyze')}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs font-semibold ml-3 shrink-0"
              >
                Upload Photo
              </button>
            </div>
          )}

          <VoiceAssistant currentResult={currentResult} booking={booking} />

          {!currentResult && (
            <div className="mt-6 pt-6 border-t border-border/80 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Want context from an image?</span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                onClick={() => navigate('analyze')}
              >
                <Camera size={14} />
                Analyse skin first
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Monitor({
  currentResult,
  navigate,
  onBook,
}: {
  currentResult: PredictResponse | null
  navigate: (view: View) => void
  onBook: () => void
}) {
  const topCondition = currentResult?.top3?.[0]?.[0]
  const topProb = currentResult?.top3?.[0]?.[1] ? (currentResult.top3[0][1] * 100).toFixed(1) : null

  return (
    <section className="app-view editorial-section">
      <div className="view-heading">
        <p className="eyebrow">10/10 AI Clinical Decision Support</p>
        <h1>
          Structured AI Notes &
          <br />
          <em>Final Summary Report.</em>
        </h1>
        <p>
          Synthesizing deep learning multi-class logits, asymmetry morphometrics, and clinical RAG evidence into an actionable diagnostic summary report.
        </p>
      </div>

      {/* AI Summary Report Card */}
      <div className="mt-8 space-y-6">
        <div className="p-6 rounded-2xl border border-border bg-card shadow-lg space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border/70">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary block">
                OptiDerma AI Clinical Synthesis Report
              </span>
              <h2 className="text-xl font-extrabold text-foreground mt-1">
                {currentResult ? `Diagnostic Finding: ${topCondition?.toUpperCase()} (${topProb}%)` : 'Baseline Skin Examination Workspace'}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors"
              >
                <FileText size={14} /> Print Report
              </button>
              <button
                type="button"
                onClick={onBook}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
              >
                <CalendarDays size={14} /> Book Doctor Review
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-border/80 bg-background/50 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Triage Risk Level</span>
              <p className="text-base font-extrabold text-foreground">
                {currentResult ? `${currentResult.risk.level} Risk` : 'No Active Scanning'}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentResult ? currentResult.risk.recommendation : 'Run a skin analysis to compute real-time triage risk.'}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border/80 bg-background/50 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Morphological Metrics</span>
              <p className="text-base font-extrabold text-foreground">
                {currentResult ? `${currentResult.metrics.area_mm2.toFixed(1)} mm² Area` : 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentResult ? `Asymmetry Index: ${currentResult.metrics.asymmetry_index.toFixed(2)} | Perimeter: ${currentResult.metrics.perimeter_mm.toFixed(1)} mm` : 'Awaiting image input.'}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border/80 bg-background/50 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Voice Assistant Status</span>
              <p className="text-base font-extrabold text-foreground">ElevenLabs Active</p>
              <p className="text-xs text-muted-foreground">Voice agent ready to detail follow-up steps.</p>
            </div>
          </div>

          {currentResult ? (
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Differential Diagnosis Breakdown
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {currentResult.top3.map(([cls, prob]) => {
                  const label = LESION_LABELS[cls]?.title || cls.toUpperCase()
                  const isMalignant = cls === 'mel' || cls === 'bcc' || cls === 'akiec'
                  return (
                    <div
                      key={cls}
                      className="p-3.5 rounded-xl border border-border/70 bg-background/40 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span>{label}</span>
                        <span className={isMalignant ? 'text-red-500' : 'text-emerald-500'}>
                          {(prob * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isMalignant ? 'bg-red-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.max(prob * 100, 4)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {LESION_LABELS[cls]?.description || 'Differential diagnostic category.'}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* ABCDE Feature Panel */}
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2 mt-4">
                <span className="text-xs font-bold uppercase tracking-wider text-primary block">
                  ABCDE Clinical Morphometric Assessment
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Asymmetry</span>
                    <strong className="text-foreground font-bold">{currentResult.metrics.asymmetry_index > 0.4 ? 'High Asymmetry' : 'Symmetric'}</strong>
                    <span className="text-[10px] text-muted-foreground block">Score: {currentResult.metrics.asymmetry_index.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Border</span>
                    <strong className="text-foreground font-bold">{currentResult.metrics.compactness > 1.3 ? 'Irregular' : 'Smooth'}</strong>
                    <span className="text-[10px] text-muted-foreground block">Compactness: {currentResult.metrics.compactness.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Diameter / Area</span>
                    <strong className="text-foreground font-bold">{currentResult.metrics.area_mm2.toFixed(1)} mm²</strong>
                    <span className="text-[10px] text-muted-foreground block">Perimeter: {currentResult.metrics.perimeter_mm.toFixed(1)} mm</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Evolution</span>
                    <strong className="text-foreground font-bold">In-memory Monitor</strong>
                    <span className="text-[10px] text-muted-foreground block">Track over 3–6 weeks</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between">
              <span className="text-xs text-foreground font-medium">Ready to generate your personalized 10/10 AI report?</span>
              <button
                type="button"
                onClick={() => navigate('analyze')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Upload Photo & Run
              </button>
            </div>
          )}
        </div>

        {/* Progression Tracking Timeline */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Lesion Baseline & Timeline History
          </h3>
          <div className="monitor-line">
            <div>
              <span>BASELINE</span>
              <strong>Initial Dermoscopy Capture</strong>
              <small>Visual reference point</small>
            </div>
            <div>
              <span>FOLLOW-UP</span>
              <strong>Subsequent Checkpoint</strong>
              <small>Document observations</small>
            </div>
            <div>
              <span>LATEST</span>
              <strong>Current Presentation</strong>
              <small>Always in-memory, private workspace</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
