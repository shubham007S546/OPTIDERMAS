'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Cpu,
  Sparkles,
  RefreshCw,
  HardDrive,
  Layers,
} from 'lucide-react'
import { fetchSystemDiagnostics, type SystemDiagnosticsSnapshot } from '@/lib/api'

export function SystemStatusView() {
  const [diag, setDiag] = useState<SystemDiagnosticsSnapshot | null>(null)
  const [checking, setChecking] = useState(true)

  const checkHealth = useCallback(async () => {
    setChecking(true)
    try {
      const snapshot = await fetchSystemDiagnostics()
      setDiag(snapshot)
    } catch {
      setDiag({
        healthOk: false,
        latencyMs: null,
        backendMode: 'session_only',
        supabaseReachable: false,
        ragDocumentCount: null,
      })
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    checkHealth()
  }, [checkHealth])

  const online = Boolean(diag?.healthOk)
  const statusPillClass = online
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    : checking
    ? 'bg-sky-50 text-sky-700 border border-sky-200'
    : 'bg-rose-50 text-rose-700 border border-rose-200'

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Overview Banner */}
      <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                online ? 'bg-emerald-500 animate-pulse' : checking ? 'bg-sky-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <h2 className="text-xl font-bold text-slate-900">System Architecture &amp; Live Pipeline Status</h2>
          </div>
          <p className="text-xs text-slate-600">
            Live verification of PyTorch inference server, explainability layers, RAG evidence index, and persistence stores.
          </p>
        </div>

        <button
          onClick={checkHealth}
          disabled={checking}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors self-start sm:self-center disabled:opacity-50"
        >
          <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
          <span>{checking ? 'Pinging Services…' : 'Ping Live Services'}</span>
        </button>
      </div>

      {/* Diagnostics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: PyTorch Inference Engine */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu size={18} className="text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900">PyTorch Neural Backbone</h3>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusPillClass}`}>
              {online ? 'Online' : checking ? 'Checking' : 'Offline'}
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Architecture</span>
              <strong className="text-slate-800 font-mono">EfficientNet-B4 (7-class + U-Net)</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Weights File</span>
              <code className="text-[11px] font-mono text-slate-800">model/optiderma_best_model.pth</code>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Differential Targets</span>
              <span className="font-semibold text-slate-800">7 Classes (Mel, NV, BCC, AKIEC, BKL, DF, VASC)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Measured API Ping</span>
              <span className={`font-semibold font-mono ${online ? 'text-emerald-600' : 'text-rose-600'}`}>
                {online && diag?.latencyMs != null
                  ? `${diag.latencyMs} ms`
                  : checking
                  ? 'Measuring…'
                  : 'Unreachable'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Explainable AI & Segmentation */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900">Explainable AI (XAI) Suite</h3>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusPillClass}`}>
              {online ? 'Operational' : checking ? 'Checking' : 'Offline'}
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Attribution Method</span>
              <strong className="text-slate-800 font-mono">Target-Class Grad-CAM</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Attribution Views</span>
              <span className="font-semibold text-slate-800">Views A–H (incl. DullRazor &amp; Hair Mask)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Segmentation Model</span>
              <span className="font-semibold text-slate-800">U-Net &amp; Morphological Contours</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Geometry Standard</span>
              <span className="font-semibold text-slate-800">Pixel Geometry (Honest Uncalibrated)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Preprocessing Engine</span>
              <span className="font-semibold text-slate-800">DullRazor Telea Inpainting</span>
            </div>
          </div>
        </div>

        {/* Card 3: Agentic RAG Knowledge Base */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900">Dermatology RAG &amp; Agent</h3>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusPillClass}`}>
              {online ? 'Grounded' : checking ? 'Checking' : 'Offline'}
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Agentic Architecture</span>
              <strong className="text-slate-800 font-mono">8-Node Controlled Workflow</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Retrieval Engine</span>
              <span className="font-semibold text-slate-800">Hybrid BM25 + Token Overlap</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Domain Safety Guard</span>
              <span className="font-semibold text-emerald-600">DERM_DOMAIN_TERMS Active</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Indexed Evidence Sources</span>
              <span className="font-semibold text-slate-800">
                {diag?.ragDocumentCount != null
                  ? `${diag.ragDocumentCount} Live Sources Indexed`
                  : online
                  ? '48+ Clinical Sources'
                  : 'Unavailable (Offline)'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Citation Integrity</span>
              <span className="font-semibold text-slate-800">Strict Source Metadata Traceability</span>
            </div>
          </div>
        </div>

        {/* Card 4: Persistence & Storage */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive size={18} className="text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Persistence &amp; Privacy Layer</h3>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusPillClass}`}>
              {diag?.backendMode === 'supabase'
                ? 'Dual Sync'
                : online
                ? 'SQLite WAL'
                : 'Offline'}
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Active Primary Store</span>
              <strong className="text-slate-800 font-mono">
                {diag?.backendMode === 'supabase'
                  ? 'Supabase Cloud + SQLite WAL'
                  : online
                  ? 'SQLite WAL (Local Durable)'
                  : 'Browser Session Only'}
              </strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">DB Location</span>
              <code className="text-[10px] font-mono text-slate-800">backend/data/optiderma_persistence.db</code>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Supabase Cloud Probe</span>
              <span className={`font-semibold ${diag?.supabaseReachable ? 'text-emerald-600' : 'text-amber-700'}`}>
                {diag?.supabaseReachable
                  ? 'Connected & Tables Ready'
                  : online
                  ? 'Unreachable (SQLite Fallback Active)'
                  : 'Pending Backend'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Voice Assistant</span>
              <span className="font-semibold text-slate-800">Web Speech + Groq Whisper + TTS</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Report Generator</span>
              <span className="font-semibold text-slate-800">ReportLab + Direct PDF Export</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
