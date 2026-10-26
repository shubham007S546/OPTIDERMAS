'use client'

import dynamic from 'next/dynamic'
import React, { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  Camera,
  Clock,
  Download,
  FileText,
  MessageCircle,
  Mic,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'

import {
  predictLesion,
  OptiDermaApiError,
  getMockPrediction,
  getReportPdfUrl,
  getAnalysis,
} from '@/lib/api'
import { LESION_LABELS, type PredictResponse } from '@/lib/types'
import type { BookingConfirmation } from '@/lib/booking'
import { ResultsView } from './results-view'
import { UploadZone } from './upload-zone'
import { VoiceAssistant, type VoiceBookingHandlers } from './voice-assistant'
import { ErrorBoundary } from './error-boundary'
import { ClinicalSidebar, type NavigationDestination } from './clinical-sidebar'
import { ClinicalHeader } from './clinical-header'
import { DashboardOverview } from './dashboard-overview'
import { ConsultationChat } from './consultation-chat'
import { CareConnectDialog } from './care-connect-dialog'
import { KnowledgeBaseView } from './knowledge-base-view'
import { SystemStatusView } from './system-status-view'
import { AnalysisHistoryView } from './analysis-history-view'
import { ReportsWorkspaceView } from './reports-workspace-view'
import { PrivacyControlsView } from './privacy-controls-view'
import { AgentCouncilView } from './agent-council-view'

// The offline sample button fabricates a result, so it is only offered during development
const ALLOW_SAMPLE_RESPONSE = process.env.NODE_ENV !== 'production'

const NeuralBrain = dynamic(
  () => import('@/components/neural-brain').then((module) => module.NeuralBrain),
  { ssr: false, loading: () => <div className="neural-placeholder" /> }
)

type AnalysisStage = 'idle' | 'ready' | 'uploading' | 'analysing' | 'result' | 'error'

export default function OptiDermaDashboard({
  referenceImageUrl,
}: {
  referenceImageUrl?: string
} = {}) {
  const [currentView, setCurrentView] = useState<NavigationDestination>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Upload and Analysis state
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [stage, setStage] = useState<AnalysisStage>('idle')
  const [result, setResult] = useState<PredictResponse | null>(null)
  const [error, setError] = useState<OptiDermaApiError | Error | null>(null)
  const [wakeupNotice, setWakeupNotice] = useState<string | null>(null)

  // Care Connect Dialog state
  const [careConnectOpen, setCareConnectOpen] = useState(false)
  const [careConnectInitialTab, setCareConnectInitialTab] = useState<'search' | 'request' | 'summary' | 'history'>('search')

  // Open Care Connect with specific tab
  const openCareConnect = useCallback((tab: 'search' | 'request' | 'summary' | 'history' = 'search') => {
    setCareConnectInitialTab(tab)
    setCareConnectOpen(true)
  }, [])

  const handleAgentBooked = useCallback((booking: BookingConfirmation) => {
    openCareConnect('history')
  }, [openCareConnect])

  const voiceBooking: VoiceBookingHandlers = {
    onOpenBooking: () => openCareConnect('request'),
    onAgentBooked: handleAgentBooked,
  }

  // Revoke object URL on cleanup
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [preview])

  // Select file WITHOUT resizing, cropping, or compressing
  const handleFileSelect = (selectedFile: File) => {
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview)
    }

    const objectUrl = URL.createObjectURL(selectedFile)
    setFile(selectedFile)
    setPreview(objectUrl)
    setResult(null)
    setError(null)
    setWakeupNotice(null)
    setStage('ready')
    setCurrentView('analyze')
  }

  // Select a stored case from history or dashboard
  const handleSelectAnalysis = async (analysisId: string) => {
    try {
      const record = await getAnalysis(analysisId)
      setResult(record)
      if (record.images?.original) {
        setPreview(record.images.original)
      }
      setStage('result')
      setCurrentView('analyze')
    } catch (err) {
      console.error('Failed to load past analysis:', err)
    }
  }

  // Clear everything: strictly resets session state
  const clearEverything = () => {
    if (preview && preview.startsWith('blob:')) {
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

    setResult(null)
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
      setResult(null)
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

  // Regenerate explainability attention for an alternative differential diagnosis class
  const handleSelectTargetClass = async (targetCls: string) => {
    if (!file || stage === 'uploading' || stage === 'analysing') return
    try {
      const response = await predictLesion(file, {
        force: true,
        targetClass: targetCls,
        onProgress: (stg) => setStage(stg),
      })
      setResult(response)
      setStage('result')
    } catch (err: unknown) {
      console.error('Failed to regenerate CAM for target class:', err)
    }
  }

  // Navigation handler
  const handleNavigate = (dest: NavigationDestination) => {
    if (dest === 'care-connect') {
      openCareConnect('search')
      return
    }
    if (dest === 'summaries') {
      openCareConnect('summary')
      return
    }
    if (dest === 'appointments') {
      openCareConnect('history')
      return
    }
    setCurrentView(dest)
  }

  return (
    <ErrorBoundary fallbackTitle="OptiDerma Dashboard Fault">
      <div className="min-h-screen bg-slate-50/70 text-slate-900 flex font-sans antialiased selection:bg-sky-100 selection:text-sky-900">
        {/* Persistent Collapsible Left Sidebar */}
        <ClinicalSidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          analysisAttached={Boolean(result || file)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          {/* Compact Clinical Header */}
          <ClinicalHeader
            currentView={currentView}
            onNavigate={handleNavigate}
            onToggleSidebarMobile={() => setMobileSidebarOpen(true)}
            onOpenCareConnect={() => openCareConnect('search')}
            onClearSession={clearEverything}
            analysisAttached={Boolean(result || file)}
            persistenceMode="local_sqlite"
          />

          {/* Scrollable Viewport */}
          <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
            <AnimatePresence mode="wait">
              {/* 1. DASHBOARD OVERVIEW */}
              {currentView === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <DashboardOverview
                    onNavigate={handleNavigate}
                    onSelectAnalysis={handleSelectAnalysis}
                    onOpenCareConnect={() => openCareConnect('search')}
                    currentAnalysisId={result?.analysis_id}
                  />
                </motion.div>
              )}

              {/* 2. NEW SKIN ANALYSIS WORKSPACE */}
              {currentView === 'analyze' && (
                <motion.div
                  key="analyze"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <AnalyzeWorkspace
                    file={file}
                    preview={preview}
                    stage={stage}
                    result={result}
                    error={error}
                    wakeupNotice={wakeupNotice}
                    onFileSelect={handleFileSelect}
                    onRun={() => runAnalysis(false)}
                    onRunForced={() => runAnalysis(true)}
                    onReset={() => {
                      setFile(null)
                      setPreview(null)
                      setResult(null)
                      setStage('idle')
                    }}
                    onUseMock={handleUseMockFallback}
                    onConsult={() => setCurrentView('consult-chat')}
                    onChat={() => setCurrentView('consult-chat')}
                    onBook={() => openCareConnect('request')}
                    onSelectTargetClass={handleSelectTargetClass}
                  />
                </motion.div>
              )}

              {/* MULTI-AGENT CLINICAL COUNCIL */}
              {currentView === 'council' && (
                <motion.div
                  key="council"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <AgentCouncilView
                    analysisId={result?.analysis_id}
                    onNavigateToChat={() => setCurrentView('consult-chat')}
                    onNavigateToCare={() => openCareConnect('request')}
                  />
                </motion.div>
              )}

              {/* 3. PERSISTED ANALYSIS HISTORY */}
              {currentView === 'history' && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <AnalysisHistoryView
                    onSelectAnalysis={handleSelectAnalysis}
                    onNavigate={handleNavigate}
                  />
                </motion.div>
              )}

              {/* 4. AI DERMATOLOGY CHAT (10x Enhanced Clinical RAG Engine) */}
              {(currentView === 'consult-chat' || currentView === 'consult-voice') && (
                <motion.div
                  key="consult-chat"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="max-w-5xl mx-auto space-y-4"
                >
                  <ConsultationChat
                    currentResult={result}
                    onOpenCareConnect={() => openCareConnect('search')}
                    onOpenConsultationSummary={() => openCareConnect('summary')}
                  />
                </motion.div>
              )}


              {/* 6. DERMATOLOGY KNOWLEDGE BASE */}
              {currentView === 'knowledge' && (
                <motion.div
                  key="knowledge"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <KnowledgeBaseView />
                </motion.div>
              )}

              {/* 7. CLINICAL REPORTS & PDF PREVIEW */}
              {currentView === 'reports' && (
                <motion.div
                  key="reports"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <ReportsWorkspaceView
                    currentResult={result}
                    onSelectAnalysis={handleSelectAnalysis}
                    onNavigateAnalyze={() => setCurrentView('analyze')}
                  />
                </motion.div>
              )}

              {/* 8. DATA PRIVACY & STORAGE CONTROLS */}
              {currentView === 'privacy' && (
                <motion.div
                  key="privacy"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <PrivacyControlsView onClearSession={clearEverything} />
                </motion.div>
              )}

              {/* 9. SYSTEM DIAGNOSTICS */}
              {currentView === 'status' && (
                <motion.div
                  key="status"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <SystemStatusView />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>

        {/* Global Care Connect Modal */}
        <CareConnectDialog
          open={careConnectOpen}
          onClose={() => setCareConnectOpen(false)}
          currentResult={result}
          initialTab={careConnectInitialTab}
        />
      </div>
    </ErrorBoundary>
  )
}

/**
 * Clean Clinical Skin Analysis Workspace.
 * Preserves the exact inference, DullRazor preprocessing, Grad-CAM (A-F), and U-Net segmentation.
 */
function AnalyzeWorkspace({
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
  onChat,
  onBook,
  onSelectTargetClass,
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
  onChat: () => void
  onBook: () => void
  onSelectTargetClass?: (cls: string) => void
}) {
  const isProcessing = stage === 'uploading' || stage === 'analysing'

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Heading */}
      <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-1">
        <div className="flex items-center gap-2 text-sky-600 font-bold text-xs uppercase tracking-wider">
          <Camera size={16} />
          <span>Clinical Dermoscopy Analysis & XAI Suite</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900">
          Upload and Evaluate Skin Concern
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
          Stream uncompressed dermoscopy bytes directly to the PyTorch server. The system computes 7-class differential probabilities, DullRazor hair artifact mitigation, and spatial Grad-CAM attributions.
        </p>
      </div>

      {/* Wakeup notice banner if backend takes > 5 seconds */}
      {wakeupNotice && (
        <div
          role="status"
          className="flex items-center gap-3 p-4 rounded-2xl border border-sky-300 bg-sky-50 text-sky-900 text-xs shadow-2xs"
        >
          <Clock className="size-4 animate-spin text-sky-600 shrink-0" />
          <span>{wakeupNotice}</span>
        </div>
      )}

      {/* Error state with retry controls */}
      {stage === 'error' && error && (
        <div
          role="alert"
          className="p-5 rounded-2xl border border-rose-300 bg-rose-50/80 text-slate-900 space-y-3 shadow-2xs"
        >
          <div className="flex items-center gap-2.5 font-bold text-sm text-rose-700">
            <AlertCircle className="size-5 shrink-0 text-rose-600" />
            <span>Analysis Request Failed</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-700">{error.message}</p>
          {'detail' in error && error.detail && (
            <pre className="p-3 rounded-xl bg-white border border-rose-200 text-[11px] font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap">
              {String(error.detail)}
            </pre>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {error instanceof OptiDermaApiError && error.qualityRejected ? (
              <button
                type="button"
                onClick={onRunForced}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors"
              >
                <RefreshCw className="size-3.5" />
                Analyse anyway
              </button>
            ) : (
              <button
                type="button"
                onClick={onRun}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors"
              >
                <RefreshCw className="size-3.5" />
                Retry Analysis
              </button>
            )}
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            >
              <RotateCcw className="size-3.5" />
              Upload another image
            </button>
            {ALLOW_SAMPLE_RESPONSE && (
              <button
                type="button"
                onClick={onUseMock}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-[11px] font-medium text-slate-600 hover:text-slate-900 transition-colors ml-auto"
                title="Development only: renders a sample response, NOT a real analysis"
              >
                <Sparkles className="size-3 text-sky-600" />
                Load sample demo result
              </button>
            )}
          </div>
        </div>
      )}

      {/* If result is ready, show rich ResultsView */}
      {stage === 'result' && result && preview ? (
        <div className="space-y-6">
          <ResultsView
            previewUrl={preview}
            result={result}
            onReset={onReset}
            onConsult={onConsult}
            onChat={onChat}
            onBook={onBook}
            onSelectTargetClass={onSelectTargetClass}
          />
        </div>
      ) : (
        /* Workspace when preparing or running */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left panel: Upload or Image Preview */}
          <div className="lg:col-span-7 p-6 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-100">
              <span>Image Evidence</span>
              <span className="text-sky-600">
                {isProcessing ? 'Streaming Bytes' : file ? 'Ready for Inference' : 'Awaiting Upload'}
              </span>
            </div>

            {preview && file ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 min-h-[360px] flex items-center justify-center">
                <img
                  src={preview}
                  alt="Selected skin lesion for analysis"
                  className="max-h-[460px] w-full object-contain"
                />
                <button
                  onClick={onReset}
                  disabled={isProcessing}
                  aria-label="Remove uploaded image"
                  className="absolute top-3 right-3 p-2 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-sm border border-slate-200 disabled:opacity-50 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="py-2">
                <UploadZone onFileSelect={onFileSelect} />
              </div>
            )}

            {file && stage === 'ready' && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="text-xs">
                  <span className="font-bold block text-slate-900">{file.name}</span>
                  <span className="text-[11px] text-slate-500">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • Uncompressed raw image bytes
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onRun}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  <span>Run Model Inference</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            )}

            {isProcessing && (
              <div className="p-4 rounded-2xl border border-sky-200 bg-sky-50 text-xs text-sky-900 flex items-center gap-3">
                <RefreshCw className="size-4 animate-spin text-sky-600 shrink-0" />
                <span>
                  {stage === 'uploading'
                    ? 'Streaming original bytes to model server…'
                    : 'PyTorch model computing 7-class differential, Grad-CAM, and segmentation…'}
                </span>
              </div>
            )}
          </div>

          {/* Right panel: 3D Metaphor */}
          <div className="lg:col-span-5 p-6 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-100">
              <span>Explainability Metaphor</span>
              <span className="text-teal-600">{isProcessing ? 'Processing' : 'Active'}</span>
            </div>

            <div className="min-h-[340px] rounded-2xl bg-gradient-to-b from-sky-50/60 to-slate-50 border border-slate-200 flex items-center justify-center p-4">
              <NeuralBrain state={isProcessing ? 'active' : 'idle'} className="w-full h-[320px]" />
            </div>

            <p className="text-xs text-slate-500 leading-relaxed text-center">
              A visual metaphor for deep convolutional feature extraction. Genuine heatmaps appear in the results panel once computed.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
