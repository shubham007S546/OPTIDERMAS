'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { LesionImages, LesionMetrics } from '@/lib/types'

interface LesionCanvasProps {
  previewUrl: string
  metrics?: LesionMetrics
  images?: LesionImages
  className?: string
}

export function LesionCanvas({ previewUrl, metrics, images, className = '' }: LesionCanvasProps) {
  const [activeTab, setActiveTab] = useState<'original' | 'clean' | 'segmentation' | 'attention'>('original')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const hasClean = Boolean(images?.clean)
  const hasMask = Boolean(images?.mask_overlay)
  const hasCam = Boolean(images?.cam_overlay)

  useEffect(() => {
    // Canvas contour drawing is rendered when on 'original' tab
    if (activeTab !== 'original') return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = previewUrl

    let cancelled = false

    img.onload = () => {
      if (cancelled) return

      const width = img.naturalWidth || 512
      const height = img.naturalHeight || 512
      canvas.width = width
      canvas.height = height

      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      if (metrics?.contour && metrics.contour.length > 2) {
        ctx.save()
        ctx.beginPath()

        const scaleX = width / 256
        const scaleY = height / 256

        const first = metrics.contour[0]
        ctx.moveTo(first[0] * scaleX, first[1] * scaleY)

        for (let i = 1; i < metrics.contour.length; i++) {
          const pt = metrics.contour[i]
          ctx.lineTo(pt[0] * scaleX, pt[1] * scaleY)
        }

        ctx.closePath()

        ctx.fillStyle = 'rgba(38, 216, 228, 0.22)'
        ctx.fill()

        ctx.strokeStyle = '#26d8e4'
        ctx.lineWidth = Math.max(2, Math.round(width / 160))
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.shadowColor = 'rgba(38, 216, 228, 0.7)'
        ctx.shadowBlur = 8
        ctx.stroke()

        ctx.restore()
      }
    }

    return () => {
      cancelled = true
    }
  }, [previewUrl, metrics, activeTab])

  // Determine current image source based on active tab
  let displayImageSrc: string | null = null
  if (activeTab === 'original') {
    displayImageSrc = previewUrl
  } else if (activeTab === 'clean') {
    displayImageSrc = images?.clean ?? null
  } else if (activeTab === 'segmentation') {
    displayImageSrc = images?.mask_overlay ?? null
  } else if (activeTab === 'attention') {
    displayImageSrc = images?.cam_overlay ?? null
  }

  return (
    <div ref={containerRef} className={`relative flex flex-col items-center w-full ${className}`}>
      {/* View Switcher: A (Original), B (DullRazor De-haired), C (U-Net Mask), D (Grad-CAM) */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 mb-3 rounded-xl bg-muted/60 border border-border shadow-xs text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('original')}
          className={`px-3 py-1 rounded-lg transition-all ${
            activeTab === 'original'
              ? 'bg-primary text-primary-foreground shadow-xs font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          A · Raw Upload
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('clean')}
          disabled={!hasClean}
          className={`px-3 py-1 rounded-lg transition-all ${
            activeTab === 'clean'
              ? 'bg-primary text-primary-foreground shadow-xs font-bold'
              : !hasClean
              ? 'opacity-40 cursor-not-allowed'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title={
            hasClean
              ? 'DullRazor morphological inpainting & Beer-Lambert optical normalization'
              : 'Run analysis to see DullRazor output'
          }
        >
          B · DullRazor
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('segmentation')}
          disabled={!hasMask}
          className={`px-3 py-1 rounded-lg transition-all ${
            activeTab === 'segmentation'
              ? 'bg-primary text-primary-foreground shadow-xs font-bold'
              : !hasMask
              ? 'opacity-40 cursor-not-allowed'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title={hasMask ? 'U-Net segmentation mask' : 'Run analysis to see segmentation mask'}
        >
          C · U-Net Mask
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('attention')}
          disabled={!hasCam}
          className={`px-3 py-1 rounded-lg transition-all ${
            activeTab === 'attention'
              ? 'bg-primary text-primary-foreground shadow-xs font-bold'
              : !hasCam
              ? 'opacity-40 cursor-not-allowed'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title={hasCam ? 'Grad-CAM saliency heatmap' : 'Run analysis to see Grad-CAM heatmap'}
        >
          D · Grad-CAM
        </button>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl bg-black/5 dark:bg-black/40 flex items-center justify-center border border-border min-h-[200px]">
        {activeTab === 'original' ? (
          <canvas
            ref={canvasRef}
            className="w-full h-auto max-h-[460px] object-contain"
            aria-label="Dermoscopy image with annotated contour boundary"
          />
        ) : displayImageSrc ? (
          <img
            src={displayImageSrc}
            alt={`Lesion visualization: ${activeTab}`}
            className="w-full h-auto max-h-[460px] object-contain"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center px-6">
            <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-xs text-muted-foreground">
              {activeTab === 'clean' && 'DullRazor output will appear after analysis completes'}
              {activeTab === 'segmentation' && 'U-Net segmentation mask will appear after analysis completes'}
              {activeTab === 'attention' && 'Grad-CAM heatmap will appear after analysis completes'}
            </p>
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground text-center">
        {activeTab === 'original' &&
          'A · Original dermoscopy image with 256×256 segmentation contour overlay'}
        {activeTab === 'clean' &&
          (hasClean
            ? 'B · DullRazor hair removal + Beer-Lambert optical illumination normalization'
            : 'B · Run analysis to generate DullRazor de-haired view')}
        {activeTab === 'segmentation' &&
          (hasMask
            ? 'C · U-Net multi-task binary lesion boundary delineation (50% threshold)'
            : 'C · Run analysis to generate segmentation mask')}
        {activeTab === 'attention' &&
          (hasCam
            ? 'D · EfficientNet-B4 Grad-CAM class activation saliency heatmap'
            : 'D · Run analysis to generate Grad-CAM heatmap')}
      </p>
    </div>
  )
}
