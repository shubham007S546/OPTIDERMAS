'use client'

import React, { useRef, useState } from 'react'
import { Camera, FileUp, Info, ShieldAlert, ShieldCheck, UploadCloud, Sparkles } from 'lucide-react'

interface UploadZoneProps {
  onFileSelect: (file: File) => void
  disabled?: boolean
  className?: string
}

export function UploadZone({
  onFileSelect,
  disabled = false,
  className = '',
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleSelectSample = (sampleType: 'nevus' | 'keratosis' | 'melanoma') => {
    if (disabled || typeof window === 'undefined') return
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw background skin tone
    ctx.fillStyle = '#f6d5be'
    ctx.fillRect(0, 0, 256, 256)

    // Add subtle skin texture noise
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#f2cca8' : '#fadbc0'
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5)
    }

    if (sampleType === 'nevus') {
      // Symmetrical smooth brown mole
      const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 60)
      grad.addColorStop(0, '#532f18')
      grad.addColorStop(0.7, '#7b4c2b')
      grad.addColorStop(1, '#f6d5be')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(128, 128, 55, 0, Math.PI * 2)
      ctx.fill()
    } else if (sampleType === 'keratosis') {
      // Scaly rough keratosis
      const grad = ctx.createRadialGradient(124, 124, 15, 124, 124, 65)
      grad.addColorStop(0, '#935639')
      grad.addColorStop(0.6, '#b87754')
      grad.addColorStop(0.9, '#dd9e76')
      grad.addColorStop(1, '#f6d5be')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.ellipse(128, 124, 62, 50, Math.PI / 6, 0, Math.PI * 2)
      ctx.fill()
      // Add crusty scale spots
      ctx.fillStyle = '#fce5d4'
      for (let s = 0; s < 18; s++) {
        ctx.fillRect(100 + Math.random() * 50, 100 + Math.random() * 45, 3, 2)
      }
    } else {
      // Asymmetric variegated dark lesion
      const grad = ctx.createRadialGradient(115, 115, 15, 130, 130, 75)
      grad.addColorStop(0, '#1c1514')
      grad.addColorStop(0.4, '#3e241c')
      grad.addColorStop(0.7, '#6d3c2a')
      grad.addColorStop(1, '#f6d5be')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.ellipse(120, 126, 68, 48, Math.PI / 4, 0, Math.PI * 2)
      ctx.fill()
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const sampleFile = new File([blob], `sample_${sampleType}_case.jpg`, { type: 'image/jpeg' })
        validateAndHandle(sampleFile)
      }
    }, 'image/jpeg', 0.95)
  }

  const validateAndHandle = (file?: File | null) => {
    setValidationError(null)
    if (!file) return

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!validTypes.includes(file.type.toLowerCase())) {
      setValidationError('Unsupported format. Please select a valid JPG, PNG, or WEBP image.')
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      setValidationError('File size exceeds the 20 MB limit. Please select an image under 20 MB.')
      return
    }

    // Pass the raw original File without re-encoding
    onFileSelect(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    validateAndHandle(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  return (
    <div className={`w-full space-y-4 ${className}`}>
      {/* Validation alert */}
      {validationError && (
        <div
          role="alert"
          className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-center gap-2"
        >
          <ShieldAlert className="size-4 shrink-0 text-red-600 dark:text-red-400" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Dropzone Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center p-8 text-center rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.005]'
            : 'border-border/80 hover:border-primary/60 bg-card/50'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        aria-label="Upload dermoscopy image"
      >
        <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
          <UploadCloud className="size-7" />
        </div>
        <strong className="text-base font-semibold text-foreground">
          Drag & drop your skin lesion image
        </strong>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Select a high-resolution dermoscopic image or use your device camera.
        </p>

        {/* Buttons for explicit triggers */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors shadow-2xs"
          >
            <FileUp className="size-3.5" />
            Browse Files
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors shadow-2xs"
          >
            <Camera className="size-3.5" />
            Use Camera
          </button>
        </div>

        <small className="text-[11px] text-muted-foreground mt-3 block">
          Supported: JPG, PNG, WEBP · Up to 20 MB · Original bytes preserved
        </small>
      </div>

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          validateAndHandle(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          validateAndHandle(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {/* 1-Click Interactive Demo Cases */}
      <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-primary" />
            <span className="text-xs font-bold text-foreground">Or Test With a Verified Demo Case:</span>
          </div>
          <span className="text-[10px] text-muted-foreground">1-Click Instant AI Analysis</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleSelectSample('nevus')}
            disabled={disabled}
            className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 text-left transition-all flex items-center gap-2 group cursor-pointer"
          >
            <span className="size-2 rounded-full bg-emerald-500 shrink-0 group-hover:scale-125 transition-transform" />
            <div className="min-w-0">
              <span className="block text-xs font-bold text-foreground truncate">Common Mole</span>
              <span className="block text-[10px] text-muted-foreground truncate">Typical Benign Nevus</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSample('keratosis')}
            disabled={disabled}
            className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 text-left transition-all flex items-center gap-2 group cursor-pointer"
          >
            <span className="size-2 rounded-full bg-amber-500 shrink-0 group-hover:scale-125 transition-transform" />
            <div className="min-w-0">
              <span className="block text-xs font-bold text-foreground truncate">Rough Sun Spot</span>
              <span className="block text-[10px] text-muted-foreground truncate">Pre-cancerous Keratosis</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSample('melanoma')}
            disabled={disabled}
            className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/15 text-left transition-all flex items-center gap-2 group cursor-pointer"
          >
            <span className="size-2 rounded-full bg-rose-500 shrink-0 group-hover:scale-125 transition-transform" />
            <div className="min-w-0">
              <span className="block text-xs font-bold text-foreground truncate">Irregular Lesion</span>
              <span className="block text-[10px] text-muted-foreground truncate">Atypical High Concern</span>
            </div>
          </button>
        </div>
      </div>

      {/* Patient Photography Best Practices */}
      <div className="p-4 rounded-2xl border border-border/70 bg-card/60 space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
          Tips For Best Results From Home
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-base shrink-0">💡</span>
            <div>
              <strong className="text-foreground block font-medium">Even Lighting</strong>
              <span>Use natural daylight. Avoid harsh shadows or strong phone flash reflections.</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-base shrink-0">🎯</span>
            <div>
              <strong className="text-foreground block font-medium">4–6 Inches Away</strong>
              <span>Center the spot cleanly in your camera screen so it fills the middle third.</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-base shrink-0">🔍</span>
            <div>
              <strong className="text-foreground block font-medium">Tap to Focus</strong>
              <span>Tap your screen directly on the spot to ensure sharp border definition.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dermoscopy and Red-flag Clinical Guidance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl border border-border/70 bg-card/60 flex items-start gap-2.5">
          <Info className="size-4 shrink-0 text-primary mt-0.5" />
          <p className="text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Dermoscopy Notice: </span>
            Trained on dermatological lesion standards. If unsure, an in-person dermoscopy exam is recommended.
          </p>
        </div>
        <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-2.5">
          <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <p className="text-amber-900 dark:text-amber-200 leading-relaxed">
            <span className="font-semibold">Red Flag Warning: </span>
            Seek immediate medical attention if your lesion bleeds spontaneously, oozes, itches persistently, or hurts.
          </p>
        </div>
      </div>
    </div>
  )
}
