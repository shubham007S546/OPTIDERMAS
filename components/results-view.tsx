'use client'

import React, { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  Layers,
  Mic,
  Printer,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { LESION_LABELS, type PredictResponse } from '@/lib/types'
import { LesionCanvas } from './lesion-canvas'

interface ResultsViewProps {
  previewUrl: string
  result: PredictResponse
  onReset: () => void
  onConsult: () => void
  onBook?: () => void
}

export function ResultsView({ previewUrl, result, onReset, onConsult, onBook }: ResultsViewProps) {
  const { top3, risk, metrics, images, malignant_prob } = result
  const [copied, setCopied] = useState(false)

  const topPrediction = top3[0]
  const topKey = topPrediction ? topPrediction[0] : 'nv'
  const topProbability = topPrediction ? topPrediction[1] : 0
  const topPct = (topProbability * 100).toFixed(1)
  const isUncertain = topProbability < 0.6
  const labelInfo = LESION_LABELS[topKey] || {
    title: topKey.toUpperCase(),
    subtitle: 'Dermatological condition',
    description: 'Clinical evaluation recommended.',
  }

  const isMalignant = topKey === 'mel' || topKey === 'bcc' || topKey === 'akiec'
  const riskColor = risk.color.toLowerCase()

  // Generate a reproducible report ID based on metrics
  const reportId = `OD-${Math.abs(Math.round(metrics.area_mm2 * 100 + metrics.asymmetry_index * 1000)).toString(36).toUpperCase()}`
  const currentDate = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())

  const handleCopySummary = () => {
    const text = `OptiDerma Clinical Report [${reportId}]: Top Diagnosis: ${labelInfo.title} (${topPct}%), Risk: ${risk.level}, Area: ${metrics.area_mm2.toFixed(1)} mm², Malignancy likelihood: ${(malignant_prob * 100).toFixed(1)}%.`
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Top Meta Bar: Medical ID, Quality Passed Badge, Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-xs font-mono font-bold tracking-wider text-primary">
            REPORT #{reportId}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Multi-scale DullRazor Optical Gatekeeper: <b>Active</b></span>
            <span className="hidden sm:inline text-muted-foreground/50">·</span>
            <span className="hidden sm:inline">{currentDate}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            title="Copy Report Summary to Clipboard"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Share'}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            title="Print or Export PDF"
          >
            <Printer className="size-3.5" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* Hero Diagnostic Verdict Card */}
      <div
        className={`relative overflow-hidden rounded-3xl border p-6 sm:p-8 transition-all ${
          riskColor === 'red' || isMalignant
            ? 'border-red-500/40 bg-gradient-to-br from-red-500/10 via-card to-background shadow-red-500/5'
            : riskColor === 'amber' || riskColor === 'yellow'
            ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-card to-background shadow-amber-500/5'
            : 'border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-card to-background shadow-emerald-500/5'
        } shadow-xl`}
      >
        {/* Subtle Decorative Background Glow */}
        <div
          className={`absolute -right-20 -top-20 size-72 rounded-full blur-3xl opacity-20 pointer-events-none ${
            riskColor === 'red' || isMalignant
              ? 'bg-red-500'
              : riskColor === 'amber' || riskColor === 'yellow'
              ? 'bg-amber-500'
              : 'bg-emerald-500'
          }`}
        />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${
                  riskColor === 'red' || isMalignant
                    ? 'border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300'
                    : riskColor === 'amber' || riskColor === 'yellow'
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {riskColor === 'red' || isMalignant ? (
                  <ShieldAlert className="size-3.5" />
                ) : (
                  <ShieldCheck className="size-3.5" />
                )}
                {risk.level} Triage Category
              </span>

              {isMalignant ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30">
                  Malignancy-Spectrum Indicator
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  Benign Presentation Pattern
                </span>
              )}
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {labelInfo.title}
              </h2>
              <p className="text-sm font-medium text-muted-foreground mt-0.5">
                {labelInfo.subtitle}
              </p>
            </div>

            <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed pt-1">
              {risk.recommendation}
            </p>
          </div>

          {/* Key Metrics Stat Ring & Badges */}
          <div className="flex flex-wrap items-center gap-4 self-stretch md:self-auto justify-start md:justify-end">
            <div className="p-4 rounded-2xl border border-border/80 bg-background/60 backdrop-blur-md min-w-[130px] text-center space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                Confidence
              </span>
              <p
                className={`text-2xl sm:text-3xl font-black font-mono ${
                  isMalignant ? 'text-red-600 dark:text-red-400' : 'text-primary'
                }`}
              >
                {topPct}%
              </p>
              <span className="text-[10px] text-muted-foreground block font-medium">
                Calibrated posterior
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-border/80 bg-background/60 backdrop-blur-md min-w-[140px] text-center space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                Malignancy Risk
              </span>
              <p
                className={`text-2xl sm:text-3xl font-black font-mono ${
                  malignant_prob > 0.4 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {(malignant_prob * 100).toFixed(1)}%
              </p>
              <span className="text-[10px] text-muted-foreground block font-medium">
                High-concern pool
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Uncertainty Notice if Confidence is below threshold */}
      {isUncertain && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-2xl border border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Low Model Confidence Notice</h4>
            <p className="text-xs mt-0.5 leading-relaxed opacity-90">
              The primary prediction confidence is below 60%. Borderline features and overlapping textures
              require hands-on clinical dermoscopy by a certified practitioner.
            </p>
          </div>
        </div>
      )}

      {/* Core Studio Grid: Visual Evidence Canvas (Left) + Differential Diagnostics (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Dermoscopy Visual Evidence Studio */}
        <div className="lg:col-span-6 p-5 rounded-3xl border border-border/90 bg-card/70 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Dermoscopy Multi-Spectral Studio
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground">
              FOV: 15.0 mm Calibrated
            </span>
          </div>

          <LesionCanvas previewUrl={previewUrl} metrics={metrics} images={images} />

          <p className="text-[11px] text-muted-foreground leading-relaxed text-center pt-1">
            Toggle between raw dermoscopy, DullRazor hair-free optical plane, neural segmentation mask,
            and Grad-CAM feature attention heatmap.
          </p>
        </div>

        {/* Right Column: Differential Top-3 & ABCDE Morphometric Analysis */}
        <div className="lg:col-span-6 space-y-6">
          {/* Differential Top-3 Breakdown */}
          <div className="p-5 rounded-3xl border border-border/90 bg-card/70 backdrop-blur-md shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-border/60">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Differential Diagnosis Breakdown
              </h3>
              <span className="text-[11px] text-muted-foreground font-medium">
                Top 3 Subtypes
              </span>
            </div>

            <div className="space-y-4">
              {top3.map(([clsKey, prob], idx) => {
                const item = LESION_LABELS[clsKey] || {
                  title: clsKey.toUpperCase(),
                  subtitle: 'Condition',
                  description: '',
                }
                const pct = (prob * 100).toFixed(1)
                const isMal = clsKey === 'mel' || clsKey === 'bcc' || clsKey === 'akiec'

                return (
                  <div
                    key={clsKey}
                    className="p-3.5 rounded-2xl border border-border/60 bg-background/50 hover:bg-background/80 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          {idx + 1}
                        </span>
                        <div>
                          <strong className="text-sm font-bold text-foreground">
                            {item.title}
                          </strong>
                          <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
                            ({item.subtitle})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            isMal
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>

                    {/* Gradient Progress Bar */}
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isMal
                            ? 'bg-gradient-to-r from-red-500 to-rose-600'
                            : 'bg-gradient-to-r from-teal-500 to-emerald-500'
                        }`}
                        style={{ width: `${Math.max(prob * 100, 3)}%` }}
                        role="progressbar"
                        aria-valuenow={Math.round(prob * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${item.title}: ${pct}%`}
                      />
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-normal">
                      {item.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ABCDE Clinical Morphometric Assessment Panel */}
          <div className="p-5 rounded-3xl border border-border/90 bg-card/70 backdrop-blur-md shadow-lg space-y-3.5">
            <div className="flex items-center justify-between pb-1 border-b border-border/60">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                ABCDE Morphometric Measurements
              </h3>
              <span className="text-[11px] font-semibold text-primary">
                Physical Units
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-background/60 border border-border/60 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  A · Asymmetry
                </span>
                <span className="text-lg font-black font-mono text-foreground">
                  {metrics.asymmetry_index.toFixed(2)}
                </span>
                <span className="text-[10px] text-muted-foreground block font-medium">
                  {metrics.asymmetry_index > 0.4 ? 'Elevated asymmetry' : 'Normal symmetry'}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-background/60 border border-border/60 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  B · Compactness
                </span>
                <span className="text-lg font-black font-mono text-foreground">
                  {metrics.compactness.toFixed(2)}
                </span>
                <span className="text-[10px] text-muted-foreground block font-medium">
                  {metrics.compactness > 1.3 ? 'Irregular borders' : 'Smooth contour'}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-background/60 border border-border/60 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  D · Area
                </span>
                <span className="text-lg font-black font-mono text-foreground">
                  {metrics.area_mm2.toFixed(1)} <span className="text-xs font-normal">mm²</span>
                </span>
                <span className="text-[10px] text-muted-foreground block font-medium">
                  Physical surface
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-background/60 border border-border/60 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Perimeter
                </span>
                <span className="text-lg font-black font-mono text-foreground">
                  {metrics.perimeter_mm.toFixed(1)} <span className="text-xs font-normal">mm</span>
                </span>
                <span className="text-[10px] text-muted-foreground block font-medium">
                  Boundary length
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-background/60 border border-border/60 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Coverage
                </span>
                <span className="text-lg font-black font-mono text-foreground">
                  {metrics.coverage_pct.toFixed(1)} <span className="text-xs font-normal">%</span>
                </span>
                <span className="text-[10px] text-muted-foreground block font-medium">
                  Field of view %
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-background/60 border border-border/60 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  E · Evolution
                </span>
                <span className="text-base font-bold text-foreground">
                  Logged
                </span>
                <span className="text-[10px] text-muted-foreground block font-medium">
                  Baseline checkpoint
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Directive Deck: Voice Consultation, Tele-Dermatology, Rescan */}
      <div className="p-5 rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-background shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-0.5 max-w-md">
          <h4 className="text-sm font-extrabold text-foreground flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Recommended Clinical Next Steps
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Discuss these findings with the AI voice assistant or schedule a certified dermatologist tele-consultation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors"
          >
            <RotateCcw className="size-3.5" />
            Scan another photo
          </button>

          <button
            type="button"
            onClick={onConsult}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-md hover:opacity-90 transition-opacity"
          >
            <Mic className="size-3.5" />
            Discuss with Voice AI
            <ArrowRight className="size-3.5" />
          </button>

          {onBook && (
            <button
              type="button"
              onClick={onBook}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-xs font-bold shadow-md hover:opacity-90 transition-opacity"
            >
              <CalendarDays className="size-3.5" />
              Book doctor appointment
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
