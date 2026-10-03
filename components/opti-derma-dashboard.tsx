'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  Clock,
  FileText,
  ImagePlus,
  Info,
  Menu,
  MessageCircle,
  Moon,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  X,
} from 'lucide-react'

import { predictLesion, OptiDermaApiError, getMockPrediction } from '@/lib/api'
import type { PredictResponse } from '@/lib/types'
import { ResultsView } from './results-view'
import { UploadZone } from './upload-zone'
import { VoiceAssistant } from './voice-assistant'
import { ErrorBoundary } from './error-boundary'

const NeuralBrain = dynamic(
  () => import('@/components/neural-brain').then((module) => module.NeuralBrain),
  { ssr: false, loading: () => <div className="neural-placeholder" /> }
)

type View = 'home' | 'analyze' | 'consultation' | 'monitor' | 'model'
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
  const [hasConsented, setHasConsented] = useState(false)
  const [result, setResult] = useState<PredictResponse | null>(null)
  const [error, setError] = useState<OptiDermaApiError | Error | null>(null)
  const [wakeupNotice, setWakeupNotice] = useState<string | null>(null)

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
  const runAnalysis = async () => {
    if (!file || stage === 'uploading' || stage === 'analysing') return

    setError(null)
    setWakeupNotice(null)
    setStage('uploading')

    try {
      const response = await predictLesion(file, {
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
        {/* Persistent Research Disclaimer Banner */}
        <aside
          className="w-full bg-primary/10 border-b border-primary/20 text-foreground py-2 px-4 text-center text-xs font-medium flex items-center justify-center gap-2"
          role="note"
          aria-label="Regulatory and research classification"
        >
          <ShieldAlert className="size-3.5 text-primary shrink-0" />
          <span>
            <b>Research prototype. Not a medical device. Not a diagnosis.</b> Consult a qualified dermatologist for clinical evaluation.
          </span>
        </aside>

        {/* Primary Navigation Header */}
        <header className="site-nav">
          <button className="wordmark" onClick={() => navigate('home')} aria-label="OptiDerma home">
            <span className="wordmark-mark">O</span>
            <span>OPTIDERMA</span>
          </button>
          <nav className="desktop-links" aria-label="Main navigation">
            <button onClick={() => navigate('analyze')}>Analyze</button>
            <button onClick={() => navigate('consultation')}>Consult</button>
            <button onClick={() => navigate('monitor')}>Monitor</button>
            <button onClick={() => navigate('model')}>Model</button>
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
            {/* Book a session: non-functional, labeled 'Coming soon' */}
            <button
              className="nav-cta opacity-75 cursor-not-allowed"
              type="button"
              disabled
              title="Clinical tele-consultation booking is coming soon"
              aria-disabled="true"
            >
              Book a session <small className="ml-1 text-[10px] opacity-80">(Coming soon)</small>
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
                ['monitor', 'Monitor'],
                ['model', 'Model intelligence'],
              ].map(([key, label]) => (
                <button key={key} onClick={() => navigate(key as View)}>
                  {label}
                  <ArrowRight size={15} />
                </button>
              ))}
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
                hasConsented={hasConsented}
                onConsentChange={setHasConsented}
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
                hasConsented={hasConsented}
                onConsentChange={setHasConsented}
                onFileSelect={handleFileSelect}
                onRun={runAnalysis}
                onReset={clearEverything}
                onUseMock={handleUseMockFallback}
                onConsult={() => navigate('consultation')}
              />
            )}
            {view === 'consultation' && (
              <Consultation currentResult={result} navigate={navigate} />
            )}
            {view === 'monitor' && <Monitor />}
            {view === 'model' && <Model />}
          </motion.div>
        </AnimatePresence>
      </main>
    </ErrorBoundary>
  )
}

function Home({
  navigate,
  onFileSelect,
  hasConsented,
  onConsentChange,
  referenceImageUrl,
}: {
  navigate: (view: View) => void
  onFileSelect: (file: File) => void
  hasConsented: boolean
  onConsentChange: (c: boolean) => void
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
            <button className="button-quiet" onClick={() => navigate('consultation')}>
              Voice Assistant
            </button>
          </div>
          <p className="safety">
            <ShieldCheck size={15} /> AI decision support · Not a clinical diagnosis
          </p>
        </div>
        <div className="hero-engine">
          <img
            className="reference-brain-art"
            src={referenceImageUrl}
            alt="OptiDerma neural brain analysis reference"
          />
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
        <UploadZone
          onFileSelect={onFileSelect}
          hasConsented={hasConsented}
          onConsentChange={onConsentChange}
        />
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
            <span>LIVE EVIDENCE CANVAS</span>
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
        <span>Research prototype · Not a clinical diagnosis</span>
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
  hasConsented,
  onConsentChange,
  onFileSelect,
  onRun,
  onReset,
  onUseMock,
  onConsult,
}: {
  file: File | null
  preview: string | null
  stage: AnalysisStage
  result: PredictResponse | null
  error: OptiDermaApiError | Error | null
  wakeupNotice: string | null
  hasConsented: boolean
  onConsentChange: (c: boolean) => void
  onFileSelect: (f: File) => void
  onRun: () => void
  onReset: () => void
  onUseMock: () => void
  onConsult: () => void
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
            <pre className="p-3 rounded-lg bg-black/10 dark:bg-black/40 text-[11px] font-mono text-muted-foreground overflow-x-auto">
              {String(error.detail)}
            </pre>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onRun}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="size-3.5" />
              Retry Analysis
            </button>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted transition-colors"
            >
              <RotateCcw className="size-3.5" />
              Analyse another image
            </button>
            <button
              type="button"
              onClick={onUseMock}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/80 bg-muted/40 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors ml-auto"
              title="Verify UI behavior with sample backend response fixture"
            >
              <Sparkles className="size-3 text-primary" />
              Test with sample response (offline mode)
            </button>
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
                <UploadZone
                  onFileSelect={onFileSelect}
                  hasConsented={hasConsented}
                  onConsentChange={onConsentChange}
                />
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
}: {
  currentResult: PredictResponse | null
  navigate: (view: View) => void
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
          <VoiceAssistant currentResult={currentResult} />

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

function Monitor() {
  return (
    <section className="app-view editorial-section">
      <div className="view-heading">
        <p className="eyebrow">Monitor your skin</p>
        <h1>
          Keep track of
          <br />
          <em>what you notice.</em>
        </h1>
        <p>
          Build a private visual baseline for personal reference. Comparison provides personal context,
          not clinical proof of lesion progression or malignancy.
        </p>
      </div>
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
    </section>
  )
}

function Model() {
  return (
    <section className="app-view editorial-section">
      <div className="view-heading">
        <p className="eyebrow">Model intelligence</p>
        <h1>
          Honest evaluation metrics,
          <br />
          <em>made transparent.</em>
        </h1>
        <p>
          OptiDerma discloses empirical evaluation results on standard benchmarks. Automated
          lesion assessment systems have known constraints that clinicians and users must understand.
        </p>
      </div>

      {/* Primary Benchmark Evaluation Grid */}
      <div className="mt-8 space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Full Test Split — 1,002 HAM10000 Images (Image-Level Split)
        </h3>
        <div className="model-grid">
          <div>
            <span>ACCURACY</span>
            <strong>95.4%</strong>
          </div>
          <div>
            <span>MACRO F1</span>
            <strong>0.94</strong>
          </div>
          <div>
            <span>AUC (MALIGNANT VS BENIGN)</span>
            <strong>0.988</strong>
          </div>
          <div>
            <span>MELANOMA RECALL</span>
            <strong>0.87</strong>
          </div>
        </div>
      </div>

      {/* Generalization Split */}
      <div className="mt-8 space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Unseen Lesions Split — 589 Images Not Seen in Training
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl border border-border bg-card shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-primary block">
              Generalization Accuracy
            </span>
            <strong className="text-3xl font-extrabold text-foreground mt-2 block">
              96.8%
            </strong>
            <p className="text-xs text-muted-foreground mt-1">
              Evaluated across lesions completely disjoint from the training distribution.
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-border bg-card shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-primary block">
              Melanoma Recall (23 Images)
            </span>
            <strong className="text-3xl font-extrabold text-foreground mt-2 block">
              0.70 <span className="text-sm font-normal text-muted-foreground">(70.0%)</span>
            </strong>
            <p className="text-xs text-muted-foreground mt-1">
              Recall drops on unseen malignant cases, demonstrating the critical need for dermatologist review.
            </p>
          </div>
        </div>
      </div>

      {/* Disclosed Limitations */}
      <div className="model-note mt-8">
        <FileText size={20} className="shrink-0 text-primary mt-0.5" />
        <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-sm font-bold text-foreground block">
            Documented Model Limitations
          </strong>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <b>Image-level split with lesion overlap:</b> Some multi-angle captures of identical lesions may exist across train/test partitions.
            </li>
            <li>
              <b>Few test images for rare classes:</b> Rare dermatological subtypes (e.g. dermatofibroma, vascular lesions) have limited sample representation.
            </li>
            <li>
              <b>HAM10000 dataset only:</b> Model is optimized solely on the HAM10000 dataset domain.
            </li>
            <li>
              <b>No external validation:</b> Performance on clinical images from different camera sensors, clinics, or populations has not been externally validated.
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
