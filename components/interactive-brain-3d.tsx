'use client'

import React, { useState } from 'react'
import { NeuralBrain } from '@/components/neural-brain'
import { Brain, Cpu, Sparkles, Zap, RotateCcw } from 'lucide-react'

interface InteractiveBrain3DProps {
  className?: string
}

export function InteractiveBrain3D({ className = '' }: InteractiveBrain3DProps) {
  const [brainState, setBrainState] = useState<'idle' | 'active'>('active')
  const [synapsePings, setSynapsePings] = useState(150)

  const toggleStimulation = () => {
    setBrainState((prev) => (prev === 'active' ? 'idle' : 'active'))
    setSynapsePings((prev) => (prev === 150 ? 280 : 150))
  }

  return (
    <div
      className={`relative rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-50/70 via-white/85 to-teal-50/50 p-4 sm:p-5 shadow-sm backdrop-blur-md overflow-hidden transition-all duration-300 ${className}`}
      role="region"
      aria-label="3D Interactive Neural Inference Brain Model"
    >
      {/* Top Clinical Telemetry Header */}
      <div className="flex items-center justify-between z-10 relative pointer-events-auto">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2.5 w-2.5 items-center justify-center">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
                brainState === 'active' ? 'bg-cyan-500' : 'bg-slate-400'
              }`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                brainState === 'active' ? 'bg-cyan-600' : 'bg-slate-500'
              }`}
            />
          </div>
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Brain size={14} className="text-blue-700" aria-hidden="true" />
            Neural Inference Core
          </span>
        </div>

        <button
          type="button"
          onClick={toggleStimulation}
          aria-pressed={brainState === 'active'}
          aria-label={`Toggle neural synapsis state. Currently ${brainState === 'active' ? 'active' : 'resting'}`}
          title="Click to toggle neural synapsis state"
          className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 shadow-2xs hover:border-blue-300 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          <Zap size={12} className={brainState === 'active' ? 'text-amber-500 fill-amber-400' : 'text-slate-400'} aria-hidden="true" />
          <span>{brainState === 'active' ? 'Synapses Active' : 'Resting State'}</span>
          <span className="text-[10px] text-slate-400 group-hover:text-blue-600 transition-colors" aria-hidden="true">▼</span>
        </button>
      </div>

      {/* 3D WebGL Neural Brain Canvas Viewport */}
      <div className="w-full h-[220px] sm:h-[240px] relative cursor-grab active:cursor-grabbing">
        <NeuralBrain
          state={brainState}
          className="w-full h-full"
        />

        {/* Ambient Subtle Cyan/Teal Glow Halo */}
        <div
          className={`absolute inset-0 m-auto w-48 h-48 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
            brainState === 'active'
              ? 'bg-cyan-400/20 opacity-100 scale-110'
              : 'bg-blue-300/10 opacity-40 scale-90'
          }`}
        />
      </div>

      {/* Bottom Medical Inference Telemetry Ribbon */}
      <div className="z-10 relative flex items-center justify-between pt-2 border-t border-blue-100/70 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <Cpu size={13} className="text-blue-700" aria-hidden="true" />
          <span className="font-semibold text-slate-800">
            {synapsePings} Synaptic Nodes • HAM10000 / ISIC
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
          <Sparkles size={11} className="text-teal-700" aria-hidden="true" />
          <span>Multimodal 3D Engine</span>
        </div>
      </div>
    </div>
  )
}
