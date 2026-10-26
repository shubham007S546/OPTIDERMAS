'use client'

import React, { useState, useEffect } from 'react'
import {
  Clock,
  Search,
  Filter,
  FileText,
  MessageSquare,
  ArrowRight,
  Download,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  GitCompare,
  Calendar,
  Sparkles,
  Heart,
  Activity,
  CheckCircle2,
  X,
  Printer,
} from 'lucide-react'
import { fetchRecentAnalyses, getReportPdfUrl, type RecentAnalysisSummary } from '@/lib/api'
import { LESION_LABELS } from '@/lib/types'
import type { NavigationDestination } from './clinical-sidebar'

interface AnalysisHistoryViewProps {
  onSelectAnalysis: (analysisId: string) => void
  onNavigate: (dest: NavigationDestination) => void
}

const FRIENDLY_NAMES: Record<string, { plain: string; desc: string }> = {
  nv: { plain: 'Common Harmless Mole', desc: 'Benign melanocytic growth' },
  mel: { plain: 'Melanoma Check', desc: 'Pigment evaluation recommended' },
  bkl: { plain: 'Benign Age Spot / Keratosis', desc: 'Harmless seborrheic spot' },
  bcc: { plain: 'Basal Cell Carcinoma Check', desc: 'Slow-growing skin spot' },
  akiec: { plain: 'Precancerous Sun Spot (Actinic)', desc: 'Surface rough lesion' },
  vasc: { plain: 'Vascular Spot (Angioma)', desc: 'Benign blood vessel cluster' },
  df: { plain: 'Dermatofibroma', desc: 'Harmless firm skin nodule' },
}

export function AnalysisHistoryView({ onSelectAnalysis, onNavigate }: AnalysisHistoryViewProps) {
  const [analyses, setAnalyses] = useState<RecentAnalysisSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState<'all' | 'High' | 'Moderate' | 'Low'>('all')
  const [historyMode, setHistoryMode] = useState<'patient' | 'clinical'>('patient')

  // Spot Evolution Comparison State
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([])
  const [showCompareModal, setShowCompareModal] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await fetchRecentAnalyses(50)
      setAnalyses(data)
    } catch {
      setAnalyses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = analyses.filter((item) => {
    const matchRisk = riskFilter === 'all' || item.risk_level === riskFilter
    const matchSearch =
      !search ||
      item.analysis_id.toLowerCase().includes(search.toLowerCase()) ||
      item.top_condition.toLowerCase().includes(search.toLowerCase()) ||
      (LESION_LABELS[item.top_condition]?.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (FRIENDLY_NAMES[item.top_condition]?.plain || '').toLowerCase().includes(search.toLowerCase())
    return matchRisk && matchSearch
  })

  const toggleCompareSelect = (id: string) => {
    if (selectedForCompare.includes(id)) {
      setSelectedForCompare(selectedForCompare.filter((x) => x !== id))
    } else {
      if (selectedForCompare.length >= 2) {
        setSelectedForCompare([selectedForCompare[1], id])
      } else {
        setSelectedForCompare([...selectedForCompare, id])
      }
    }
  }

  const scanA = analyses.find((a) => a.analysis_id === selectedForCompare[0])
  const scanB = analyses.find((a) => a.analysis_id === selectedForCompare[1])

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Top Banner with Persona Toggle */}
      <div className="p-6 sm:p-8 rounded-3xl border border-slate-200 bg-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sky-600 font-bold text-xs uppercase tracking-wider">
            <Clock size={16} />
            <span>Persisted Lesion Records &amp; Spot Tracker</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {historyMode === 'patient' ? 'My Skin Health Log & Timeline' : 'Clinical Analysis Archive'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
            {historyMode === 'patient'
              ? 'Review all your past skin spot checks, compare changes over time, or share results directly with your doctor.'
              : 'Durable records stored in local SQLite database with full differential distributions and Grad-CAM attributions.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
          {/* Persona Switcher */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setHistoryMode('patient')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                historyMode === 'patient'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Heart size={12} />
              <span>Patient View</span>
            </button>
            <button
              type="button"
              onClick={() => setHistoryMode('clinical')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                historyMode === 'clinical'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity size={12} />
              <span>Clinician View</span>
            </button>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Spot Evolution Comparison Tray (Floating or Docked) */}
      {selectedForCompare.length > 0 && (
        <div className="p-4 rounded-2xl border-2 border-sky-400 bg-sky-50/90 shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              <GitCompare size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-sky-950">
                Spot Evolution Comparison ({selectedForCompare.length} / 2 scans selected)
              </p>
              <p className="text-[11px] text-sky-800">
                {selectedForCompare.length === 1
                  ? 'Select one more scan below to compare changes over time.'
                  : 'Ready to compare lesion stability, diagnosis consistency, and risk shift.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedForCompare.length === 2 && (
              <button
                type="button"
                onClick={() => setShowCompareModal(true)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                <GitCompare size={14} />
                <span>Open Evolution Comparison</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedForCompare([])}
              className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 font-semibold text-xs border border-slate-200 transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              historyMode === 'patient'
                ? 'Search by spot name or scan ID...'
                : 'Search by ID or clinical code (e.g. nv, mel, bcc)...'
            }
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'all', label: 'All Checks' },
            { id: 'High', label: 'Attention Needed' },
            { id: 'Moderate', label: 'Moderate' },
            { id: 'Low', label: 'Reassuring / Low' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRiskFilter(tab.id as 'all' | 'High' | 'Moderate' | 'Low')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                riskFilter === tab.id
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Analyses Table / Card List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-500">
          Loading persisted skin records…
        </div>
      ) : filtered.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs divide-y divide-slate-100">
          {filtered.map((item) => {
            const label = LESION_LABELS[item.top_condition] || {
              title: item.top_condition.toUpperCase(),
              name: item.top_condition,
            }
            const friendly = FRIENDLY_NAMES[item.top_condition] || {
              plain: label.title,
              desc: 'Skin spot finding',
            }

            const isHigh = item.risk_level === 'High'
            const scorePct = Math.round(item.top_score * 100)
            const malPct = Math.round(item.malignant_prob * 100)
            const isSelected = selectedForCompare.includes(item.analysis_id)

            return (
              <div
                key={item.analysis_id}
                className={`p-5 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isSelected ? 'bg-sky-50/60' : 'hover:bg-slate-50/80'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Checkbox for Compare */}
                    <button
                      type="button"
                      onClick={() => toggleCompareSelect(item.analysis_id)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors flex items-center gap-1 ${
                        isSelected
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-300'
                      }`}
                    >
                      <GitCompare size={11} />
                      <span>{isSelected ? 'Selected' : 'Compare'}</span>
                    </button>

                    <span className="text-sm font-bold text-slate-900">
                      {historyMode === 'patient' ? friendly.plain : label.title}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        isHigh
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : item.risk_level === 'Moderate'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {historyMode === 'patient'
                        ? isHigh
                          ? 'Attention Needed'
                          : item.risk_level === 'Moderate'
                          ? 'Observation Advised'
                          : 'Reassuring / Low Concern'
                        : `${item.risk_level} Risk`}
                    </span>

                    <span className="text-[10px] font-mono text-slate-500">
                      ID: {item.analysis_id.slice(0, 8)}
                    </span>
                  </div>

                  {historyMode === 'patient' ? (
                    <p className="text-xs text-slate-600">
                      {friendly.desc} • Match confidence: <strong className="text-slate-800">{scorePct}%</strong> • Recommended action: <em className="text-slate-700">{item.recommendation}</em>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-600">
                      Primary Score: <strong className="text-slate-800">{scorePct}%</strong> • Malignancy Probability Pool:{' '}
                      <strong className={malPct > 40 ? 'text-rose-600' : 'text-slate-800'}>{malPct}%</strong> • Recommendation:{' '}
                      <em>{item.recommendation}</em>
                    </p>
                  )}

                  <p className="text-[11px] text-slate-400">
                    Recorded on {new Date(item.created_at).toLocaleString()} • Store: {item.persistence_source}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <button
                    onClick={() => {
                      onSelectAnalysis(item.analysis_id)
                      onNavigate('analyze')
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors shadow-2xs"
                  >
                    {historyMode === 'patient' ? 'Open Care Summary' : 'Open Findings'}
                  </button>

                  <button
                    onClick={() => {
                      onSelectAnalysis(item.analysis_id)
                      onNavigate('consult-chat')
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <MessageSquare size={13} className="text-sky-600" />
                    <span>Ask AI</span>
                  </button>

                  <a
                    href={getReportPdfUrl(item.analysis_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                    title="Download Report (PDF)"
                  >
                    <Download size={14} />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="py-16 text-center border border-dashed border-slate-200 rounded-3xl bg-white space-y-3">
          <Clock size={36} className="mx-auto text-slate-300" />
          <p className="text-sm font-bold text-slate-800">No matching analyses found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search ? 'Try adjusting your search criteria.' : 'Analyses performed in OptiDerma will appear in this persistent archive.'}
          </p>
        </div>
      )}

      {/* Spot Evolution Comparison Modal */}
      {showCompareModal && scanA && scanB && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-white text-slate-900 border border-slate-200 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700 font-bold">
                  <GitCompare size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Spot Evolution &amp; Stability Tracker
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comparing two scans of your skin spot across time
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Comparison Grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Scan A */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  Scan A (Baseline)
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {FRIENDLY_NAMES[scanA.top_condition]?.plain || scanA.top_condition.toUpperCase()}
                </p>
                <p className="text-xs text-slate-600">
                  Confidence: {Math.round(scanA.top_score * 100)}% • Risk: <strong>{scanA.risk_level}</strong>
                </p>
                <p className="text-[11px] text-slate-400">
                  Recorded: {new Date(scanA.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Scan B */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                  Scan B (Follow-up)
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {FRIENDLY_NAMES[scanB.top_condition]?.plain || scanB.top_condition.toUpperCase()}
                </p>
                <p className="text-xs text-slate-600">
                  Confidence: {Math.round(scanB.top_score * 100)}% • Risk: <strong>{scanB.risk_level}</strong>
                </p>
                <p className="text-[11px] text-slate-400">
                  Recorded: {new Date(scanB.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Computed Evolution Findings */}
            <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 size={15} />
                <span>AI Evolution Analysis &amp; Stability Score</span>
              </div>
              <p className="text-sm font-bold text-emerald-950">
                {scanA.top_condition === scanB.top_condition
                  ? 'Consistent Presentation: Finding classification remains stable over time.'
                  : 'Diagnostic Variation: Primary category shifted between checks.'}
              </p>
              <p className="text-xs text-emerald-900/90 leading-relaxed">
                {scanA.risk_level === scanB.risk_level
                  ? `Both checks indicate consistent ${scanA.risk_level.toLowerCase()} risk category. No aggressive progression detected. Continue regular monthly home checks and apply broad-spectrum sunscreen.`
                  : `Risk level changed from ${scanA.risk_level} to ${scanB.risk_level}. When a skin spot shows notable changes over time (the 'E' in ABCDE), having a dermatologist inspect it with polarized dermoscopy is recommended.`}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
              >
                <Printer size={14} />
                <span>Print Comparison Sheet</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCompareModal(false)
                  onNavigate('care-connect')
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-2xs transition-colors"
              >
                <span>Find Nearby Clinic for Check</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
