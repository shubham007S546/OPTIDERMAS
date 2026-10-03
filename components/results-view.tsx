'use client'

import React from 'react'
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, RotateCcw, ShieldAlert, Sparkles } from 'lucide-react'
import { LESION_LABELS, type PredictResponse } from '@/lib/types'
import { LesionCanvas } from './lesion-canvas'

interface ResultsViewProps {
  previewUrl: string
  result: PredictResponse
  onReset: () => void
  onConsult: () => void
}

export function ResultsView({ previewUrl, result, onReset, onConsult }: ResultsViewProps) {
  const { top3, risk, metrics, images, malignant_prob } = result

  const topPrediction = top3[0]
  const topProbability = topPrediction ? topPrediction[1] : 0
  const isUncertain = topProbability < 0.6

  // Risk styling based on risk color
  const riskColor = risk.color.toLowerCase()
  const riskBorderColor =
    riskColor === 'red'
      ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
      : riskColor === 'amber' || riskColor === 'yellow'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300'
      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-300">
      {/* Uncertainty banner if top probability < 0.6 */}
      {isUncertain && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/50 bg-amber-500/15 text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Low Model Confidence</h4>
            <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
              The model is uncertain. Please see a dermatologist. Automated assessment cannot replace an expert in-person dermoscopic examination.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Visual Evidence + Differential Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Image Canvas Overlay */}
        <div className="lg:col-span-6 p-4 rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Lesion Evidence
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
              <Sparkles className="size-3" />
              Segmentation Map
            </span>
          </div>

          <LesionCanvas
            previewUrl={previewUrl}
            metrics={metrics}
            images={images}
          />
        </div>

        {/* Right Column: Differential Top-3 & Risk Analysis */}
        <div className="lg:col-span-6 space-y-5">
          {/* Risk Assessment Card */}
          <div className={`p-4 rounded-2xl border ${riskBorderColor} space-y-2`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                Risk Classification
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wide border border-current">
                {risk.level} Concern
              </span>
            </div>
            <p className="text-sm font-medium leading-relaxed">
              {risk.recommendation}
            </p>
            <div className="pt-2 border-t border-current/15 flex items-center justify-between text-xs opacity-85">
              <span>Higher-concern group assessment</span>
              <span className="font-mono font-semibold">
                {(malignant_prob * 100).toFixed(1)}% likelihood
              </span>
            </div>
          </div>

          {/* Differential Top-3 Predictions */}
          <div className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Top Differential Diagnoses
              </h3>
              <span className="text-[11px] text-muted-foreground">Calibrated model output</span>
            </div>

            <div className="space-y-3.5">
              {top3.map(([clsKey, prob], idx) => {
                const labelInfo = LESION_LABELS[clsKey] || {
                  title: clsKey.toUpperCase(),
                  subtitle: 'Skin lesion',
                  description: '',
                }
                const pct = (prob * 100).toFixed(1)

                return (
                  <div key={clsKey} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-semibold text-foreground">
                          {idx + 1}. {labelInfo.title}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({labelInfo.subtitle})
                        </span>
                      </div>
                      <span className="font-mono font-bold text-xs text-foreground">
                        {pct}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          idx === 0
                            ? 'bg-primary'
                            : 'bg-primary/50'
                        }`}
                        style={{ width: `${Math.max(prob * 100, 1.5)}%` }}
                        role="progressbar"
                        aria-valuenow={Math.round(prob * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${labelInfo.title}: ${pct}%`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quantitative Metrics with Standard Units */}
          <div className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Morphological Measurements
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Area
                </span>
                <span className="text-base font-bold font-mono text-foreground">
                  {metrics.area_mm2.toFixed(1)} <span className="text-xs font-normal">mm²</span>
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Perimeter
                </span>
                <span className="text-base font-bold font-mono text-foreground">
                  {metrics.perimeter_mm.toFixed(1)} <span className="text-xs font-normal">mm</span>
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Coverage
                </span>
                <span className="text-base font-bold font-mono text-foreground">
                  {metrics.coverage_pct.toFixed(1)} <span className="text-xs font-normal">%</span>
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Asymmetry Index
                </span>
                <span className="text-base font-bold font-mono text-foreground">
                  {metrics.asymmetry_index.toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Compactness
                </span>
                <span className="text-base font-bold font-mono text-foreground">
                  {metrics.compactness.toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Contour Points
                </span>
                <span className="text-base font-bold font-mono text-foreground">
                  {metrics.contour.length} <span className="text-xs font-normal">pts</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors"
            >
              <RotateCcw className="size-3.5" />
              Analyse another image
            </button>
            <button
              type="button"
              onClick={onConsult}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:opacity-90 transition-opacity"
            >
              Ask OptiDerma Voice Assistant
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
