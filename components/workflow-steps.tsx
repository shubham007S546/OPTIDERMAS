'use client'

import React from 'react'
import Image from 'next/image'
import { ArrowRight, Camera, Focus, Mic, Sparkles, Volume2 } from 'lucide-react'

export function WorkflowStepsSection() {
  return (
    <section className="py-16 px-4 md:px-8 max-w-7xl mx-auto">
      {/* Topline Header */}
      <div className="flex flex-col md:flex-row md:items-baseline justify-between mb-8 pb-4 border-b border-border/60 gap-2">
        <h2 className="text-xs md:text-sm font-bold tracking-wide text-blue-700 dark:text-blue-400">
          02 / From Photo to Understanding
        </h2>
        <p className="text-xs md:text-sm text-muted-foreground font-medium">
          One transparent workflow from skin concern to actionable insights.
        </p>
      </div>

      {/* 4 Cards Grid with Connecting Arrows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {/* Card 01: Photo */}
        <div className="flex flex-col justify-between rounded-2xl border border-sky-100 dark:border-sky-950/60 bg-sky-50/40 dark:bg-card/90 p-4 shadow-sm hover:shadow-md transition-all group">
          <div>
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold text-xs mb-3">
              01
            </div>

            {/* Visual: Smartphone Photo Capture */}
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-border/60 mb-4">
              <Image
                src="/images/step-photo.jpg"
                alt="Taking dermoscopy photo with smartphone"
                fill
                sizes="(max-width: 768px) 100vw, 25vw"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              {/* Focus / Scanner overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent flex items-center justify-center">
                <div className="w-16 h-16 rounded-xl border-2 border-white/80 border-dashed flex items-center justify-center backdrop-blur-[1px] shadow-lg">
                  <Camera size={22} className="text-white drop-shadow" />
                </div>
              </div>
            </div>

            <h3 className="text-lg font-bold text-foreground mb-1">Photo</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add a clear dermoscopy image.
            </p>
          </div>
        </div>

        {/* Card 02: Analysis */}
        <div className="flex flex-col justify-between rounded-2xl border border-sky-100 dark:border-sky-950/60 bg-sky-50/40 dark:bg-card/90 p-4 shadow-sm hover:shadow-md transition-all group">
          <div>
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold text-xs mb-3">
              02
            </div>

            {/* Visual: Lesion crop + Differential table */}
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-border/60 p-2 mb-4 flex gap-2 items-center">
              {/* Lesion thumbnail with heatmap inset */}
              <div className="relative w-1/2 h-full rounded-lg overflow-hidden border border-border shrink-0">
                <Image
                  src="/images/step-lesion.jpg"
                  alt="Dermoscopic lesion scan"
                  fill
                  sizes="(max-width: 768px) 50vw, 15vw"
                  className="object-cover"
                />
                {/* Crosshairs */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Focus size={24} className="text-sky-400/80 drop-shadow" />
                </div>
                {/* Mini Grad-CAM preview badge */}
                <div className="absolute bottom-1 right-1 w-6 h-6 rounded border border-white/80 overflow-hidden shadow">
                  <div className="w-full h-full bg-gradient-to-tr from-blue-600 via-amber-400 to-red-600 opacity-90" />
                </div>
              </div>

              {/* Differential Ranking Pill Table */}
              <div className="flex-1 flex flex-col justify-center gap-1 text-[10px] font-medium">
                <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold">
                  <span>Navus</span>
                  <span>0.72</span>
                </div>
                <div className="flex items-center justify-between px-1.5 py-0.5 text-muted-foreground">
                  <span>Melanoma</span>
                  <span>0.08</span>
                </div>
                <div className="flex items-center justify-between px-1.5 py-0.5 text-muted-foreground">
                  <span>BCC</span>
                  <span>0.07</span>
                </div>
                <div className="flex items-center justify-between px-1.5 py-0.5 text-muted-foreground">
                  <span>SCC</span>
                  <span>0.05</span>
                </div>
                <div className="flex items-center justify-between px-1.5 py-0.5 text-muted-foreground">
                  <span>AKIEC</span>
                  <span>0.04</span>
                </div>
                <div className="flex items-center justify-between px-1.5 py-0.5 text-muted-foreground">
                  <span>Other</span>
                  <span>0.04</span>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-bold text-foreground mb-1">Analysis</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Server model computes 7-class differential.
            </p>
          </div>
        </div>

        {/* Card 03: Explanation */}
        <div className="flex flex-col justify-between rounded-2xl border border-sky-100 dark:border-sky-950/60 bg-sky-50/40 dark:bg-card/90 p-4 shadow-sm hover:shadow-md transition-all group">
          <div>
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold text-xs mb-3">
              03
            </div>

            {/* Visual: Segmentation Contour + Legend */}
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-border/60 p-2 mb-4 flex gap-2 items-center">
              {/* Lesion with SVG contours */}
              <div className="relative w-1/2 h-full rounded-lg overflow-hidden border border-border shrink-0">
                <Image
                  src="/images/step-lesion.jpg"
                  alt="Segmentation boundary overlay"
                  fill
                  sizes="(max-width: 768px) 50vw, 15vw"
                  className="object-cover"
                />
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Outer emerald segmentation boundary */}
                  <path
                    d="M 25,45 C 20,25 45,15 65,25 C 85,35 85,65 70,80 C 50,90 30,75 25,45 Z"
                    stroke="#10b981"
                    strokeWidth="3"
                    strokeDasharray="2 1"
                    fill="none"
                  />
                  {/* Inner lesion core high risk */}
                  <path
                    d="M 38,48 C 35,38 52,32 60,38 C 70,45 68,62 58,68 C 45,72 38,62 38,48 Z"
                    stroke="#ef4444"
                    strokeWidth="2.5"
                    fill="#ef4444"
                    fillOpacity="0.2"
                  />
                </svg>
              </div>

              {/* Legend */}
              <div className="flex-1 flex flex-col justify-center gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                  <span className="text-foreground font-medium leading-tight">Lesion core (high risk)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-foreground font-medium leading-tight">Segmentation boundary (AI estimate)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-foreground font-medium leading-tight">Uncertain region</span>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-bold text-foreground mb-1">Explanation</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Inspect segmentation boundaries (not surgical margins) and feature attribution.
            </p>
          </div>
        </div>

        {/* Card 04: Consultation */}
        <div className="flex flex-col justify-between rounded-2xl border border-sky-100 dark:border-sky-950/60 bg-sky-50/40 dark:bg-card/90 p-4 shadow-sm hover:shadow-md transition-all group">
          <div>
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold text-xs mb-3">
              04
            </div>

            {/* Visual: Doctor + Live Voice Wave Bubble */}
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-border/60 mb-4">
              <Image
                src="/images/step-consultation.jpg"
                alt="Doctor consultation via voice"
                fill
                sizes="(max-width: 768px) 100vw, 25vw"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              {/* Floating speech bubble */}
              <div className="absolute top-2 right-2 left-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl p-2 border border-border/80 shadow-md flex items-center justify-between gap-2">
                <span className="text-xs text-slate-800 dark:text-slate-100 font-medium leading-snug">
                  Here are your results &amp; recommendations
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center text-white shadow">
                    <Mic size={12} />
                  </div>
                </div>
              </div>

              {/* Bottom soundwave overlay */}
              <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1 flex items-center justify-between text-white text-[10px]">
                <div className="flex items-center gap-1">
                  <Sparkles size={12} className="text-sky-300" />
                  <span className="text-sky-200 font-mono text-[9px]">10x Clinical RAG Chat</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-bold text-sky-200 bg-sky-900/60 px-1.5 py-0.5 rounded">48+ Guidelines</span>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-bold text-foreground mb-1">AI Consultation</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Consult with the 10x Enhanced Clinical RAG Chatbot grounded in 48+ peer-reviewed guidelines.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
