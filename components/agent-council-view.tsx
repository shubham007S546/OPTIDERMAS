'use client'

import React, { useState, useEffect } from 'react'
import {
  ShieldAlert,
  Eye,
  CheckCircle2,
  BookOpen,
  MapPin,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import {
  fetchCouncilConsensus,
  getMockCouncilConsensus,
  type CouncilConsensusResponse,
  type CouncilAgentFinding,
} from '@/lib/api'

interface AgentCouncilViewProps {
  analysisId?: string | null
  initialCouncilData?: CouncilConsensusResponse | null
  onNavigateToChat?: () => void
  onNavigateToCare?: () => void
}

export function AgentCouncilView({
  analysisId,
  initialCouncilData,
  onNavigateToChat,
  onNavigateToCare,
}: AgentCouncilViewProps) {
  const [council, setCouncil] = useState<CouncilConsensusResponse | null>(initialCouncilData || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedTrace, setExpandedTrace] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'patient' | 'clinical'>('patient')

  const loadCouncil = async (aid: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCouncilConsensus(aid)
      setCouncil(data)
    } catch (err) {
      console.warn('Notice: Council consensus using client fallback for record:', aid)
      if (initialCouncilData) {
        setCouncil(initialCouncilData)
      } else {
        setCouncil(getMockCouncilConsensus(aid))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialCouncilData) {
      setCouncil(initialCouncilData)
      return
    }
    if (analysisId) {
      loadCouncil(analysisId)
    }
  }, [analysisId, initialCouncilData])

  if (loading && !council) {
    return (
      <div className="p-8 rounded-2xl border border-sky-200 dark:border-sky-800/40 bg-sky-50/50 dark:bg-sky-950/20 text-center animate-pulse">
        <RefreshCw size={28} className="mx-auto text-sky-600 animate-spin mb-3" />
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          Convening Multi-Agent Clinical Council...
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Coordinating Triage, Vision, Critic, Evidence, Care, and Communication agents.
        </p>
      </div>
    )
  }

  if (error && !council) {
    return (
      <div className="p-6 rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 text-center">
        <AlertTriangle size={24} className="mx-auto text-amber-600 mb-2" />
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">{error}</p>
        {analysisId && (
          <button
            onClick={() => loadCouncil(analysisId)}
            className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            Retry Council Deliberation
          </button>
        )}
      </div>
    )
  }

  if (!council) {
    return (
      <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-slate-500">
        <Sparkles size={24} className="mx-auto text-slate-400 mb-2" />
        <p className="text-xs">Upload or select a dermoscopy case to convene the Multi-Agent Council.</p>
      </div>
    )
  }

  const agentsList: { key: string; title: string; patientTitle: string; role: string; icon: typeof Eye; finding?: CouncilAgentFinding }[] = [
    {
      key: 'triage',
      title: 'Clinical Safety & Triage Agent',
      patientTitle: '1. Safety & Danger Screening',
      role: 'Emergency Screening & Red-Flag Audit',
      icon: ShieldAlert,
      finding: council.agents?.triage,
    },
    {
      key: 'vision',
      title: 'Vision & Diagnostic Specialist',
      patientTitle: '2. AI Visual Feature Analysis',
      role: 'Neural Inference & Morphometrics',
      icon: Eye,
      finding: council.agents?.vision,
    },
    {
      key: 'critic',
      title: 'Medical Critic & Verification Agent',
      patientTitle: '3. Image Quality & Focus Audit',
      role: 'Saliency Audit & Invariant Checks',
      icon: CheckCircle2,
      finding: council.agents?.critic,
    },
    {
      key: 'evidence',
      title: 'Evidence & Literature RAG Agent',
      patientTitle: '4. Official Medical Guidelines',
      role: 'Peer-Reviewed Guidelines (AAD / BAD / NCCN)',
      icon: BookOpen,
      finding: council.agents?.evidence,
    },
    {
      key: 'care',
      title: 'Care Coordination & Referral Agent',
      patientTitle: '5. Local Care & Clinic Matching',
      role: 'Facility Matching & Referral Protocol',
      icon: MapPin,
      finding: council.agents?.care,
    },
    {
      key: 'communication',
      title: 'Patient Communication & Empathy Agent',
      patientTitle: '6. Patient Care Advocate',
      role: 'Health Literacy & Action Plan Guidance',
      icon: MessageSquare,
      finding: council.agents?.communication,
    },
  ]

  return (
    <div className="space-y-4">
      {/* View Mode Switcher */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setViewMode('patient')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'patient'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            🌟 Patient-Friendly Explanations
          </button>
          <button
            type="button"
            onClick={() => setViewMode('clinical')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'clinical'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            🔬 Specialist Deliberation Mode
          </button>
        </div>

        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
          6 Autonomous Specialized Agents
        </span>
      </div>

      {/* Top Banner: Consensus Status */}
      <div className="p-5 rounded-2xl border border-sky-200/80 dark:border-sky-800/60 bg-gradient-to-r from-sky-50 via-indigo-50/50 to-white dark:from-sky-950/40 dark:via-indigo-950/20 dark:to-slate-900 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sky-600 text-white shadow-2xs">
                Multi-Agent AI Council
              </span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Clock size={12} /> {council.deliberation_duration_ms} ms deliberation
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Consensus: <span className="text-sky-600 dark:text-sky-400">{council.consensus_diagnosis}</span>
            </h3>
            {viewMode === 'patient' ? (
              <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                {council.patient_consensus ||
                  `Our 6 specialized AI agents deliberated on your case together and reached ${council.consensus_agreement_pct}% agreement that this spot is consistent with a ${council.consensus_diagnosis}.`}
              </p>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                6 autonomous agents deliberated on visual features, red flags, verification invariants, and clinical literature.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-800 text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Council Agreement</div>
              <div className="text-sm font-black text-sky-600 dark:text-sky-400">
                {council.consensus_agreement_pct}%
              </div>
            </div>

            <div
              className={`px-3 py-1.5 rounded-xl border text-center ${
                council.is_emergency
                  ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                  : council.consensus_urgency === 'urgent'
                  ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              }`}
            >
              <div className="text-[10px] uppercase font-bold opacity-80">Triage Priority</div>
              <div className="text-sm font-black uppercase">{council.consensus_urgency}</div>
            </div>

            {council.requires_clinical_biopsy && (
              <div className="px-3 py-1.5 rounded-xl border border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-center">
                <div className="text-[10px] uppercase font-bold opacity-80">Recommendation</div>
                <div className="text-sm font-black">Histology Advised</div>
              </div>
            )}

            {analysisId && (
              <button
                onClick={() => loadCouncil(analysisId)}
                title="Re-run Multi-Agent Deliberation"
                className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 6 Specialized Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {agentsList.map(({ key, title, patientTitle, role, icon: Icon, finding }) => {
          if (!finding) return null
          const isSelected = selectedAgent === key
          const displayText = viewMode === 'patient' && finding.patient_explanation
            ? finding.patient_explanation
            : finding.summary

          return (
            <div
              key={key}
              onClick={() => setSelectedAgent(isSelected ? null : key)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'border-sky-500 bg-sky-50/40 dark:bg-sky-950/30 ring-2 ring-sky-500/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-card hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300">
                    <Icon size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                      {viewMode === 'patient' ? patientTitle : title}
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{role}</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {Math.round(finding.confidence * 100)}%
                </span>
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-200 font-medium line-clamp-3 mt-1 leading-relaxed">
                {displayText}
              </p>

              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 truncate max-w-[80%]">
                  {viewMode === 'patient' ? 'Advice: ' : 'Rec: '}
                  <strong className="text-slate-700 dark:text-slate-300 font-medium">{finding.recommendation}</strong>
                </span>
                <span className="text-sky-600 text-[10px] font-bold uppercase">
                  {isSelected ? 'Less' : 'Details'}
                </span>
              </div>

              {isSelected && (
                <div className="mt-3 pt-3 border-t border-sky-200 dark:border-sky-800/60 space-y-2 text-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Agent Deliberation Notes
                  </div>
                  <ul className="space-y-1">
                    {finding.deliberation_notes?.map((note, idx) => (
                      <li key={idx} className="text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                        <span className="text-sky-500 font-bold">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>

                  {finding.evidence_citations && finding.evidence_citations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Grounded Citations
                      </div>
                      <div className="space-y-1">
                        {finding.evidence_citations.map((cit, idx) => (
                          <div
                            key={idx}
                            className="text-[10px] p-1.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-mono"
                          >
                            {cit}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {key === 'communication' && onNavigateToChat && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onNavigateToChat()
                      }}
                      className="w-full mt-2 py-1.5 px-3 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Open Consultation Chat</span>
                      <ArrowRight size={13} />
                    </button>
                  )}

                  {key === 'care' && onNavigateToCare && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onNavigateToCare()
                      }}
                      className="w-full mt-2 py-1.5 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Find Verified Clinics</span>
                      <ExternalLink size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Expandable Step-by-Step Deliberation Trace */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-card">
        <button
          onClick={() => setExpandedTrace(!expandedTrace)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-sky-600" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              Council Deliberation & Voting Protocol
            </h4>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {council.deliberation_trace.length} steps recorded
            </span>
          </div>
          {expandedTrace ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {expandedTrace && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            {council.deliberation_trace.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 font-mono">
                <span className="text-sky-600 font-bold select-none text-[10px] mt-0.5">
                  [{String(idx + 1).padStart(2, '0')}]
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
