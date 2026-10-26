'use client'

import React, { useEffect, useState } from 'react'
import {
  ArrowRight,
  Camera,
  MessageSquare,
  ShieldCheck,
  Activity,
  BookOpen,
  CalendarDays,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Database,
  Building2,
  FileText,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { WorkflowStepsSection } from '@/components/workflow-steps'
import { fetchRecentAnalyses, type RecentAnalysisSummary } from '@/lib/api'
import { LESION_LABELS } from '@/lib/types'
import type { NavigationDestination } from './clinical-sidebar'

const InteractiveBrain3D = dynamic(
  () => import('@/components/interactive-brain-3d').then((mod) => mod.InteractiveBrain3D),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[220px] sm:h-[240px] rounded-3xl bg-blue-50/40 animate-pulse border border-blue-100 flex items-center justify-center text-slate-500 text-xs font-semibold">
        Loading 3D Neural Inference Engine...
      </div>
    ),
  }
)


interface DashboardOverviewProps {
  onNavigate: (dest: NavigationDestination) => void
  onSelectAnalysis: (analysisId: string) => void
  onOpenCareConnect: () => void
  currentAnalysisId?: string
}

export function DashboardOverview({
  onNavigate,
  onSelectAnalysis,
  onOpenCareConnect,
  currentAnalysisId,
}: DashboardOverviewProps) {
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysisSummary[]>([])
  const [loading, setLoading] = useState(true)

  const [dashboardMode, setDashboardMode] = useState<'patient' | 'clinical'>('patient')

  useEffect(() => {
    let isMounted = true
    async function loadData() {
      try {
        const analyses = await fetchRecentAnalyses(5)
        if (isMounted) setRecentAnalyses(analyses)
      } catch {
        if (isMounted) setRecentAnalyses([])
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadData()
    return () => {
      isMounted = false
    }
  }, [currentAnalysisId])

  return (
    <div className="space-y-10 pb-12 max-w-7xl mx-auto">
      {/* Welcome Hero with Persona Switcher */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xs relative overflow-hidden">
        <div className="grid lg:grid-cols-12 gap-8 items-center relative z-10">
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {/* Persona Switcher Pill */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200">
                <Sparkles size={13} className="text-blue-700" />
                <span>
                  {dashboardMode === 'patient'
                    ? 'AI Skin Health Assistant • Plain-Language & Grounded'
                    : 'AI-Assisted Dermatology Decision Support'}
                </span>
              </div>

              <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDashboardMode('patient')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    dashboardMode === 'patient'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Plain-language, patient-friendly guidance and action plans"
                >
                  <Sparkles size={12} />
                  <span>For Patients</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDashboardMode('clinical')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    dashboardMode === 'clinical'
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Specialist diagnostics, 7-class differential, Grad-CAM, & research telemetry"
                >
                  <Activity size={12} />
                  <span>Clinician View</span>
                </button>
              </div>
            </div>

            {dashboardMode === 'patient' ? (
              <>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Understand your skin <br />
                  <span className="text-emerald-700">
                    with confidence &amp; clarity.
                  </span>
                </h2>

                <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                  Concerned about a mole, rash, or unusual spot? Upload a photo to receive a warm, plain-language explanation, ABCDE visual signs, and sensible care steps in seconds — backed by advanced AI vision and dermatologist guidelines.
                </p>

                {/* Primary Patient Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => onNavigate('analyze')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all group"
                  >
                    <Camera size={16} aria-hidden="true" />
                    <span>Check My Skin Spot</span>
                    <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                  </button>

                  <button
                    onClick={() => onNavigate('consult-chat')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-transparent hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold border border-slate-200 transition-colors"
                  >
                    <MessageSquare size={16} className="text-emerald-600" aria-hidden="true" />
                    <span>Chat with AI Skin Assistant</span>
                  </button>

                  <button
                    onClick={() => onNavigate('council')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs sm:text-sm font-semibold border border-sky-200 transition-colors"
                  >
                    <Sparkles size={16} className="text-sky-600" aria-hidden="true" />
                    <span>Meet Multi-Agent Council</span>
                  </button>

                  <button
                    onClick={onOpenCareConnect}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 text-xs sm:text-sm font-medium transition-colors"
                  >
                    <Building2 size={16} className="text-blue-700" aria-hidden="true" />
                    <span>Find Dermatologists Near Me</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Objective clinical evidence <br />
                  <span className="text-blue-900">
                    before diagnostic assumptions.
                  </span>
                </h2>

                <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                  Examine 7-class differential predictions from the HAM10000/ISIC skin disease dataset, Grad-CAM attention maps, segmentation boundaries, and peer-reviewed dermatology literature citations in one unified clinical workflow.
                </p>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => onNavigate('analyze')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-bold shadow-xs transition-all group"
                  >
                    <Camera size={16} aria-hidden="true" />
                    <span>New Skin Analysis</span>
                    <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                  </button>

                  <button
                    onClick={() => onNavigate('consult-chat')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-transparent hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold border border-slate-200 transition-colors"
                  >
                    <MessageSquare size={16} className="text-blue-700" aria-hidden="true" />
                    <span>Ask AI Dermatology Assistant</span>
                  </button>

                  <button
                    onClick={() => onNavigate('council')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs sm:text-sm font-semibold border border-sky-200 transition-colors"
                  >
                    <Sparkles size={16} className="text-sky-600" aria-hidden="true" />
                    <span>Multi-Agent Council</span>
                  </button>

                  <button
                    onClick={onOpenCareConnect}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 text-xs sm:text-sm font-medium transition-colors"
                  >
                    <Building2 size={16} className="text-blue-700" aria-hidden="true" />
                    <span>Find Clinics &amp; Care Connect</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 3D Moving Neural Brain Inference Visualizer */}
          <div className="lg:col-span-5 xl:col-span-4 w-full">
            <InteractiveBrain3D />
          </div>
        </div>

        {/* Ambient subtle clinical watermark */}
        <div className="absolute -right-8 -bottom-14 opacity-[0.025] pointer-events-none select-none hidden 2xl:block">
          <Activity size={360} className="text-blue-900" />
        </div>
      </section>

      {/* System Metric Cards Ribbon */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {dashboardMode === 'patient' ? (
          <>
            <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-50/30 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-800">AI Vision Check</span>
                <Activity size={16} className="text-emerald-600" />
              </div>
              <p className="text-lg font-extrabold text-slate-900">10,000+ Training Cases</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Clinical dermoscopy dataset</p>
            </div>

            <div className="p-4 rounded-2xl border border-sky-500/30 bg-sky-50/30 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-sky-800">Plain-English GenAI</span>
                <Sparkles size={16} className="text-sky-600" />
              </div>
              <p className="text-lg font-extrabold text-slate-900">Warm &amp; Reassuring</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Zero confusing medical jargon</p>
            </div>

            <div className="p-4 rounded-2xl border border-teal-500/30 bg-teal-50/30 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-teal-800">Trusted Guidelines</span>
                <BookOpen size={16} className="text-teal-600" />
              </div>
              <p className="text-lg font-extrabold text-slate-900">AAD &amp; BAD Evidence</p>
              <p className="text-[11px] text-slate-600 mt-0.5">American &amp; British protocols</p>
            </div>

            <div className="p-4 rounded-2xl border border-indigo-500/30 bg-indigo-50/30 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-800">Privacy &amp; Safety</span>
                <ShieldCheck size={16} className="text-indigo-600" />
              </div>
              <p className="text-lg font-extrabold text-slate-900">100% Private</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Your photos stay confidential</p>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600">Model Engine</span>
                <Activity size={16} className="text-emerald-500" />
              </div>
              <p className="text-lg font-extrabold text-slate-900">EfficientNet-B4</p>
              <p className="text-[11px] text-slate-600 mt-0.5">7-Class Differential Inference</p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600">Explainable AI</span>
                <Sparkles size={16} className="text-sky-500" />
              </div>
              <p className="text-lg font-extrabold text-slate-900">Grad-CAM + U-Net</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Views A–F &amp; Morphometrics</p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600">Dermatology RAG</span>
                <BookOpen size={16} className="text-teal-500" />
              </div>
              <p className="text-lg font-extrabold text-slate-900">34 Verified Guidelines</p>
              <p className="text-[11px] text-slate-600 mt-0.5">7 Classes • AAD, BAD, NCCN, JAAD</p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600">Persistence</span>
                <Database size={16} className="text-indigo-500" />
              </div>
              <p className="text-lg font-extrabold text-slate-900">Supabase &amp; SQLite</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Cloud Sync + Local WAL Dual-Write</p>
            </div>
          </>
        )}
      </section>

      {/* 30-Second Skin Triage Pre-Screen */}
      <section className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="text-base font-bold text-amber-950">
                Red-Flag Self-Check: When to See a Dermatologist Promptly
              </h3>
              <p className="text-xs text-amber-900/80">
                If your skin spot exhibits any of these warning signs, we recommend scheduling an in-person clinical exam:
              </p>
            </div>
          </div>
          <button
            onClick={onOpenCareConnect}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shrink-0 shadow-xs"
          >
            Find Dermatologist
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-white border border-amber-200/80 space-y-1 shadow-2xs">
            <span className="font-bold text-amber-950 block">🩸 Spontaneous Bleeding</span>
            <p className="text-slate-600 text-[11px]">Bleeding, crusting, or oozing without being scratched.</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white border border-amber-200/80 space-y-1 shadow-2xs">
            <span className="font-bold text-amber-950 block">⚡ Rapid Growth</span>
            <p className="text-slate-600 text-[11px]">Noticeably doubling in size or elevating in under 4–6 weeks.</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white border border-amber-200/80 space-y-1 shadow-2xs">
            <span className="font-bold text-amber-950 block">🎨 Multi-Colored Tones</span>
            <p className="text-slate-600 text-[11px]">Shows multiple patchy shades of red, dark brown, or black.</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white border border-amber-200/80 space-y-1 shadow-2xs">
            <span className="font-bold text-amber-950 block">🩹 Persistent Pain / Itch</span>
            <p className="text-slate-600 text-[11px]">Continuous itching, burning, stinging, or soreness.</p>
          </div>
        </div>
      </section>

      {/* HAM10000 / ISIC Dataset Differential & RAG Mapping Section */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-semibold border border-blue-200">
              <Database size={12} className="text-blue-700" aria-hidden="true" />
              <span>Dataset &amp; Knowledge Base Linkage</span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              HAM10000 / ISIC Skin Disease Differential & RAG Evidence
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
              OptiDerma's RAG knowledge repository is <strong>directly mapped to the 7 skin disease classes</strong> of the HAM10000 and ISIC benchmark dataset used to train our PyTorch classification model, grounded in peer-reviewed clinical guidelines (AAD, BAD, IDS, JAAD).
            </p>
          </div>
          <button
            onClick={() => onNavigate('knowledge')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors self-start md:self-center shrink-0"
          >
            <BookOpen size={14} className="text-blue-700" />
            <span>Explore All 13 Guidelines</span>
          </button>
        </div>

        {/* 7 Dataset Disease Classes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. MEL */}
          <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/30 hover:bg-rose-50/60 transition-colors flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                  mel
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white uppercase">
                  Malignant
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Cutaneous Melanoma</h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Asymmetric pigmentation, atypical pigment network, blue-white veil, peripheral dots.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-rose-100/80 flex items-center justify-between text-[11px]">
              <span className="text-rose-900 font-semibold">AAD 2022 Guidelines</span>
              <button
                onClick={() => onNavigate('consult-chat')}
                className="text-blue-700 hover:text-blue-900 font-bold hover:underline"
              >
                Ask RAG →
              </button>
            </div>
          </div>

          {/* 2. BCC */}
          <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/30 hover:bg-rose-50/60 transition-colors flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                  bcc
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white uppercase">
                  Malignant
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Basal Cell Carcinoma</h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Arborizing telangiectasias, pearly shiny white structures, spoke-wheel areas, ulceration.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-rose-100/80 flex items-center justify-between text-[11px]">
              <span className="text-rose-900 font-semibold">BAD 2021 Guidelines</span>
              <button
                onClick={() => onNavigate('consult-chat')}
                className="text-blue-700 hover:text-blue-900 font-bold hover:underline"
              >
                Ask RAG →
              </button>
            </div>
          </div>

          {/* 3. AKIEC */}
          <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/30 hover:bg-amber-50/60 transition-colors flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                  akiec
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-600 text-white uppercase">
                  Pre-malignant
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Actinic Keratoses & Bowen's</h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Erythematous background, strawberry pattern, keratotic follicular plugs, scaling.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-amber-100/80 flex items-center justify-between text-[11px]">
              <span className="text-amber-900 font-semibold">Jaad 2021 Review</span>
              <button
                onClick={() => onNavigate('consult-chat')}
                className="text-blue-700 hover:text-blue-900 font-bold hover:underline"
              >
                Ask RAG →
              </button>
            </div>
          </div>

          {/* 4. NV */}
          <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60 transition-colors flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                  nv
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white uppercase">
                  Benign
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Melanocytic Nevus (Mole)</h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Symmetric architecture, uniform reticular pigment network, homogeneous regular globules.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-emerald-100/80 flex items-center justify-between text-[11px]">
              <span className="text-emerald-900 font-semibold">IDS 2023 Consensus</span>
              <button
                onClick={() => onNavigate('consult-chat')}
                className="text-blue-700 hover:text-blue-900 font-bold hover:underline"
              >
                Ask RAG →
              </button>
            </div>
          </div>

          {/* 5. BKL */}
          <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60 transition-colors flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                  bkl
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white uppercase">
                  Benign
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Benign Keratosis-like (BKL)</h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Seborrheic keratosis / solar lentigo, milia-like cysts, comedo-like openings, brain-like gyri.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-emerald-100/80 flex items-center justify-between text-[11px]">
              <span className="text-emerald-900 font-semibold">Jaad / Jcad (2020)</span>
              <button
                onClick={() => onNavigate('consult-chat')}
                className="text-blue-700 hover:text-blue-900 font-bold hover:underline"
              >
                Ask RAG →
              </button>
            </div>
          </div>

          {/* 6. DF */}
          <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60 transition-colors flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                  df
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white uppercase">
                  Benign
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Dermatofibroma</h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Central white scar-like patch, delicate delicate peripheral pigment network, positive pinch sign.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-emerald-100/80 flex items-center justify-between text-[11px]">
              <span className="text-emerald-900 font-semibold">DPC 2022 Guidelines</span>
              <button
                onClick={() => onNavigate('consult-chat')}
                className="text-blue-700 hover:text-blue-900 font-bold hover:underline"
              >
                Ask RAG →
              </button>
            </div>
          </div>

          {/* 7. VASC */}
          <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60 transition-colors flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
                  vasc
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-700 text-white uppercase">
                  Benign
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Vascular Lesions &amp; Hemangiomas</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Red, purple, or blue-black round lagoons with distinct septa and absence of pigment network.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-emerald-100/80 flex items-center justify-between text-xs">
              <span className="text-emerald-900 font-semibold">DPC 2022 Criteria</span>
              <button
                onClick={() => onNavigate('consult-chat')}
                className="text-blue-700 hover:text-blue-900 font-semibold hover:underline"
              >
                Ask RAG →
              </button>
            </div>
          </div>

          {/* 8. General Dermatology & Inflammatory Conditions (Balances the 3-column grid) */}
          <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/30 hover:bg-blue-50/50 transition-colors flex flex-col justify-between md:col-span-1 lg:col-span-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 border border-blue-200">
                  rag-gen
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-700 text-white uppercase">
                  Clinical Guidelines
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">General Dermatology &amp; Inflammatory Guidelines</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Atopic Dermatitis &amp; Eczema, Plaque Psoriasis, Acne Vulgaris (AAD 2024), Rosacea (JAAD 2023), and Epidermal Barrier Repair.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-blue-100/80 flex items-center justify-between text-xs">
              <span className="text-blue-900 font-semibold">13 Peer-Reviewed Sources</span>
              <button
                onClick={() => onNavigate('consult-chat')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-blue-700 border border-slate-200 font-semibold shadow-2xs transition-colors"
              >
                <span>Ask General Skin Question</span>
                <ArrowRight size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Step Process Section ("02 / FROM PHOTO TO UNDERSTANDING") */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <WorkflowStepsSection />
      </section>

      {/* Recent Analyses & Case Studies */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recent Lesion Analyses</h3>
            <p className="text-xs text-slate-600">
              Persisted cases from local clinical storage with verified differential outputs.
            </p>
          </div>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline flex items-center gap-1"
          >
            <span>View All Records</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-600">
            Loading recent analyses…
          </div>
        ) : recentAnalyses.length > 0 ? (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
            {recentAnalyses.map((rec) => {
              const labelInfo = LESION_LABELS[rec.top_condition] || {
                title: rec.top_condition.toUpperCase(),
                name: rec.top_condition,
              }
              const scorePct = Math.round(rec.top_score * 100)
              const malPct = Math.round(rec.malignant_prob * 100)
              const isHigh = rec.risk_level === 'High'

              return (
                <div
                  key={rec.analysis_id}
                  className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {labelInfo.title}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isHigh
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : rec.risk_level === 'Moderate'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {rec.risk_level} Risk
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">
                      Primary Softmax Score: <strong className="text-slate-800">{scorePct}%</strong> • Malignancy Group Score:{' '}
                      <strong className={malPct > 40 ? 'text-rose-600' : 'text-slate-800'}>{malPct}%</strong>
                    </p>

                    <p className="text-xs text-slate-500 font-mono">
                      <span className="font-sans font-medium text-slate-600">Case:</span>{' '}
                      {rec.analysis_id.startsWith('OD-TEST-')
                        ? `od-test-${rec.analysis_id.slice(8, 16).toLowerCase()}…`
                        : `${rec.analysis_id.slice(0, 12)}…`}{' '}
                      • {new Date(rec.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => onSelectAnalysis(rec.analysis_id)}
                      className="px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs border border-sky-200 transition-colors"
                    >
                      Open Case
                    </button>
                    <button
                      onClick={() => {
                        onSelectAnalysis(rec.analysis_id)
                        onNavigate('consult-chat')
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors"
                    >
                      Ask AI
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl space-y-3">
            <Camera size={36} className="mx-auto text-slate-300" />
            <div>
              <p className="text-sm font-bold text-slate-800">No Past Analyses in Local Store</p>
              <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                Begin by uploading a skin lesion photo to compute differential predictions and Grad-CAM visualizations.
              </p>
            </div>
            <button
              onClick={() => onNavigate('analyze')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors"
            >
              <Camera size={14} />
              <span>Check First Skin Photo</span>
            </button>
          </div>
        )}
      </section>

      {/* Clinical Disclaimer Footer */}
      <footer className="p-4 rounded-2xl bg-slate-100/60 border border-slate-200/80 text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
          <span>
            <strong>Clinical Safety Statement</strong>: OptiDerma provides investigational decision support and triage coordination, not a standalone diagnostic confirmation.
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-600 shrink-0">
          Local Store: optiderma_persistence.db
        </span>
      </footer>
    </div>
  )
}
