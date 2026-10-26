'use client'

import React, { useState } from 'react'
import {
  ShieldCheck,
  Lock,
  Database,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  HardDrive,
  Info,
} from 'lucide-react'

interface PrivacyControlsViewProps {
  onClearSession: () => void
}

export function PrivacyControlsView({ onClearSession }: PrivacyControlsViewProps) {
  const [cleared, setCleared] = useState(false)

  const handleClear = () => {
    onClearSession()
    setCleared(true)
    setTimeout(() => setCleared(false), 3000)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-2">
        <div className="flex items-center gap-2 text-sky-600 font-bold text-xs uppercase tracking-wider">
          <ShieldCheck size={16} />
          <span>Patient Privacy & Clinical Data Architecture</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900">
          Honest Transparency & Local Data Governance
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          OptiDerma operates under a transparent, verifiable privacy model. We do not transmit medical images to unauthorized third-party vision APIs. All deep learning neural evaluations occur on your configured inference server.
        </p>
      </div>

      {/* Persistence Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Database size={16} className="text-sky-600" />
            <span>Local Durable Storage</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Analyses, verification logs, conversation turns, and appointment requests are securely persisted in a local SQLite database at:
          </p>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-800 break-all">
            backend/data/optiderma_persistence.db
          </div>
          <p className="text-[11px] text-slate-500">
            This database is entirely under your control and never exported to external advertising or analytics trackers.
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Lock size={16} className="text-teal-600" />
            <span>Image Bytes & Inference Isolation</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Uploaded dermoscopy photos are streamed in original resolution directly to the PyTorch server. DullRazor hair removal and Grad-CAM happen server-side with coordinate preservation.
          </p>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
              <CheckCircle2 size={13} />
              <span>Zero third-party vision API leakage</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
              <CheckCircle2 size={13} />
              <span>Session memory cache isolated per browser tab</span>
            </div>
          </div>
        </div>
      </div>

      {/* Session Controls Box */}
      <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Session Reset & Memory Flush</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          Purging the active session revokes object URLs in the browser, clears the in-memory analysis cache, and returns the workspace to an empty state.
        </p>

        {cleared && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>Active session cache successfully cleared. Workspace has been reset.</span>
          </div>
        )}

        <button
          onClick={handleClear}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-colors"
        >
          <Trash2 size={14} />
          <span>Purge Active Workspace Memory</span>
        </button>
      </div>
    </div>
  )
}
