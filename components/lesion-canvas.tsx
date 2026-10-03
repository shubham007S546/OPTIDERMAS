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
  const [activeTab, setActiveTab] = useState<'original' | 'segmentation' | 'attention'>('original')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const hasOverlayImages = Boolean(
    images && (images.mask_overlay || images.cam_overlay)
  )

  useEffect(() => {
    // If we have pre-rendered overlay images from backend and not in 'original' tab, do not draw contour canvas
    if (hasOverlayImages && activeTab !== 'original') return

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

      // Adjust canvas resolution to match image natural or container size
      const width = img.naturalWidth || 512
      const height = img.naturalHeight || 512
      canvas.width = width
      canvas.height = height

      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      // Draw contour if metrics available and contour points exist
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

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(38, 216, 228, 0.22)'
        ctx.fill()

        // Vibrant neon boundary line
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
  }, [previewUrl, metrics, hasOverlayImages, activeTab])

  // Determine current image source based on active tab
  let displayImageSrc = previewUrl
  if (activeTab === 'segmentation' && images?.mask_overlay) {
    displayImageSrc = images.mask_overlay
  } else if (activeTab === 'attention' && images?.cam_overlay) {
    displayImageSrc = images.cam_overlay
  } else if (images?.original) {
    displayImageSrc = images.original
  }

  return (
    <div ref={containerRef} className={`relative flex flex-col items-center w-full ${className}`}>
      {/* View Switcher if backend returned pre-rendered overlays */}
      {hasOverlayImages && (
        <div className="flex items-center gap-1.5 p-1 mb-3 rounded-lg bg-surface border border-border shadow-xs text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('original')}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeTab === 'original'
                ? 'bg-accent text-accent-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Original + Contour
          </button>
          {images?.mask_overlay && (
            <button
              type="button"
              onClick={() => setActiveTab('segmentation')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeTab === 'segmentation'
                  ? 'bg-accent text-accent-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Segmentation Mask
            </button>
          )}
          {images?.cam_overlay && (
            <button
              type="button"
              onClick={() => setActiveTab('attention')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeTab === 'attention'
                  ? 'bg-accent text-accent-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Attention (CAM)
            </button>
          )}
        </div>
      )}

      <div className="relative w-full overflow-hidden rounded-xl bg-black/5 dark:bg-black/40 flex items-center justify-center border border-border">
        {hasOverlayImages && activeTab !== 'original' ? (
          <img
            src={displayImageSrc}
            alt={`Lesion visualization: ${activeTab}`}
            className="w-full h-auto max-h-[460px] object-contain"
          />
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full h-auto max-h-[460px] object-contain"
            aria-label="Dermoscopy image with annotated contour boundary"
          />
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground text-center">
        {hasOverlayImages && activeTab !== 'original'
          ? `Showing backend ${activeTab} inference map`
          : 'Contour boundary computed from 256×256 segmentation space'}
      </p>
    </div>
  )
}
