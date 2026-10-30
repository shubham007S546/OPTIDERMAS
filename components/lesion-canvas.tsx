'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Download,
  Eye,
  Info,
  Layers,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sliders,
  Sparkles,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  CheckCircle2,
  Grid3X3,
  Scissors,
} from 'lucide-react'
import type { HairRemovalDiagnostics, LesionImages, LesionMetrics, XaiDiagnostics } from '@/lib/types'
import { fetchClassXai } from '@/lib/api'

export type XaiViewType =
  | 'view_a_original'
  | 'view_b_raw_cam'
  | 'view_c_overlay'
  | 'view_d_boundary'
  | 'view_e_comparison'
  | 'view_f_classes'
  | 'view_g_dullrazor'
  | 'view_h_hair_mask'

interface LesionCanvasProps {
  previewUrl: string
  metrics?: LesionMetrics
  images?: LesionImages
  xai?: XaiDiagnostics
  hairRemoval?: HairRemovalDiagnostics
  analysisId?: string
  top3?: [string, number][]
  currentClassTarget?: string
  onSelectTargetClass?: (classCode: string) => void
  className?: string
}

export function LesionCanvas({
  previewUrl,
  metrics,
  images,
  xai,
  hairRemoval,
  analysisId,
  top3 = [],
  currentClassTarget,
  onSelectTargetClass,
  className = '',
}: LesionCanvasProps) {
  const [activeView, setActiveView] = useState<XaiViewType>('view_c_overlay')
  const [zoomLevel, setZoomLevel] = useState<number>(1.0)
  const [opacity, setOpacity] = useState<number>(0.65)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [selectedClass, setSelectedClass] = useState<string>(
    currentClassTarget || (top3[0] ? top3[0][0] : 'mel')
  )

  // State for dynamic class XAI fetching (for View F and alternate classes)
  const [classXaiData, setClassXaiData] = useState<Record<string, { raw_cam: string; cam_overlay: string; energy_inside_pct: number }> | null>(null)
  const [loadingClassXai, setLoadingClassXai] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const activeTargetClass = selectedClass || (top3[0] ? top3[0][0] : 'top-1')

  // Load multi-class comparison when entering View F
  useEffect(() => {
    if (activeView === 'view_f_classes' && analysisId && !classXaiData && !loadingClassXai) {
      setLoadingClassXai(true)
      fetchClassXai(analysisId, 'compare')
        .then((data) => {
          const comp = data?.comparison || data?.classes
          if (comp) {
            setClassXaiData(comp)
          }
        })
        .catch((err) => {
          console.error('Failed to load multi-class XAI comparison:', err)
        })
        .finally(() => {
          setLoadingClassXai(false)
        })
    }
  }, [activeView, analysisId, classXaiData, loadingClassXai])

  // Handle single class target change
  const handleTargetClassSelect = async (cls: string) => {
    setSelectedClass(cls)
    onSelectTargetClass?.(cls)
    if (analysisId && cls !== top3[0]?.[0]) {
      try {
        const resp = await fetchClassXai(analysisId, cls)
        if (resp && resp.cam_overlay && resp.raw_cam) {
          setClassXaiData((prev) => ({
            ...prev,
            [cls]: {
              raw_cam: resp.raw_cam as string,
              cam_overlay: resp.cam_overlay as string,
              energy_inside_pct: Number(resp.energy_inside_pct) || 0,
            },
          }))
        }
      } catch (e) {
        console.error('Error fetching dynamic class XAI:', e)
      }
    }
  }

  // Draw View D / Contour on Canvas
  useEffect(() => {
    if (activeView !== 'view_d_boundary') return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = images?.clean || previewUrl

    let cancelled = false

    img.onload = () => {
      if (cancelled) return

      const width = img.naturalWidth || 256
      const height = img.naturalHeight || 256
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

        ctx.fillStyle = 'rgba(16, 185, 129, 0.25)' // Emerald tint
        ctx.fill()

        ctx.strokeStyle = '#10b981'
        ctx.lineWidth = Math.max(2, Math.round(width / 130))
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.shadowColor = 'rgba(16, 185, 129, 0.8)'
        ctx.shadowBlur = 6
        ctx.stroke()

        ctx.restore()
      }
    }

    return () => {
      cancelled = true
    }
  }, [previewUrl, images, metrics, activeView])

  // Determine active displayed image src
  let displayImageSrc: string = previewUrl
  if (activeView === 'view_a_original') {
    displayImageSrc = images?.original || previewUrl
  } else if (activeView === 'view_b_raw_cam') {
    displayImageSrc = classXaiData?.[selectedClass]?.raw_cam || images?.raw_cam || images?.cam_overlay || previewUrl
  } else if (activeView === 'view_c_overlay') {
    displayImageSrc = classXaiData?.[selectedClass]?.cam_overlay || images?.cam_overlay || previewUrl
  } else if (activeView === 'view_d_boundary') {
    displayImageSrc = images?.mask_overlay || previewUrl
  } else if (activeView === 'view_e_comparison') {
    displayImageSrc = classXaiData?.[selectedClass]?.cam_overlay || images?.cam_overlay || previewUrl
  } else if (activeView === 'view_g_dullrazor') {
    displayImageSrc = images?.clean || images?.original || previewUrl
  } else if (activeView === 'view_h_hair_mask') {
    displayImageSrc = images?.hair_mask || images?.original || previewUrl
  }

  const handleDownloadActiveImage = () => {
    if (!displayImageSrc) return
    const link = document.createElement('a')
    link.href = displayImageSrc
    link.download = `optiderma_${activeView}_${activeTargetClass}.png`
    link.click()
  }

  return (
    <div ref={containerRef} className={`relative flex flex-col items-center w-full space-y-3 ${className}`}>
      {/* View Selector & Class Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 w-full">
        {/* Views A–F Switcher */}
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-muted/70 border border-border text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setActiveView('view_a_original')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              activeView === 'view_a_original'
                ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="View A: Untouched Original Image"
          >
            A · Raw
          </button>

          <button
            type="button"
            onClick={() => setActiveView('view_b_raw_cam')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              activeView === 'view_b_raw_cam'
                ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="View B: Raw Normalized Saliency Heatmap (No background)"
          >
            B · Raw CAM
          </button>

          <button
            type="button"
            onClick={() => setActiveView('view_c_overlay')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              activeView === 'view_c_overlay'
                ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="View C: Grad-CAM Overlay with Opacity Control"
          >
            C · Overlay
          </button>

          <button
            type="button"
            onClick={() => setActiveView('view_d_boundary')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              activeView === 'view_d_boundary'
                ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="View D: Valid U-Net Lesion Boundary Contour"
          >
            D · Boundary
          </button>

          <button
            type="button"
            onClick={() => setActiveView('view_e_comparison')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              activeView === 'view_e_comparison'
                ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="View E: Spatial Energy Diagnostic (Inside vs Outside Lesion)"
          >
            E · Energy
          </button>

          <button
            type="button"
            onClick={() => setActiveView('view_f_classes')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              activeView === 'view_f_classes'
                ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="View F: Side-by-Side Class Comparison"
          >
            F · Compare
          </button>

          <button
            type="button"
            onClick={() => setActiveView('view_g_dullrazor')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              activeView === 'view_g_dullrazor'
                ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="View G: DullRazor Inpainted Clean Image (Artifact Cleanse)"
          >
            G · De-Haired
          </button>

          <button
            type="button"
            onClick={() => setActiveView('view_h_hair_mask')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              activeView === 'view_h_hair_mask'
                ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="View H: Isolated Binary Hair Mask (Morphological Black-Hat)"
          >
            H · Hair Mask
          </button>
        </div>

        {/* Dynamic Class Target Selector */}
        {top3 && top3.length > 0 && activeView !== 'view_f_classes' && (
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-card border border-border text-xs">
            <span className="text-[10px] uppercase font-bold text-muted-foreground px-1">Class:</span>
            {top3.map(([cls]) => (
              <button
                key={cls}
                type="button"
                onClick={() => handleTargetClassSelect(cls)}
                className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold uppercase transition-all ${
                  selectedClass === cls
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={`Compute Grad-CAM for class ${cls}`}
              >
                {cls}
              </button>
            ))}
          </div>
        )}

        {/* Zoom & Download Toolbar */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border text-xs">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.2))}
            className="p-1 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut size={13} />
          </button>
          <span className="font-mono text-[10px] px-1 font-semibold text-muted-foreground">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
            className="p-1 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn size={13} />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomLevel(1.0)
              setOpacity(0.65)
            }}
            className="p-1 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground"
            title="Reset Zoom & Opacity"
            aria-label="Reset View"
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            onClick={handleDownloadActiveImage}
            className="p-1 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground"
            title="Download active layer"
            aria-label="Download active layer"
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      {/* Opacity Slider for Overlay View */}
      {activeView === 'view_c_overlay' && (
        <div className="flex items-center justify-between gap-3 w-full px-3 py-1.5 rounded-xl bg-card border border-border/70 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sliders size={13} className="text-primary" />
            <span className="font-semibold text-[11px]">Heatmap Opacity:</span>
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-full accent-primary h-1.5 cursor-pointer bg-muted rounded-lg"
              aria-label="Grad-CAM opacity slider"
            />
            <span className="font-mono text-[11px] font-bold text-foreground w-9 text-right">
              {Math.round(opacity * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Main Viewport */}
      {activeView === 'view_f_classes' ? (
        /* View F: Multi-Class Attribution Side-by-Side Comparison */
        <div className="w-full p-4 rounded-2xl bg-card border border-border space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Grid3X3 className="size-4 text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Class-Specific Attribution Comparison (View F)
              </h4>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Independent backpropagation per differential class target
            </span>
          </div>

          {loadingClassXai ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Computing class-specific backpropagation gradients…</span>
            </div>
          ) : classXaiData ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(classXaiData).map(([clsKey, cData]) => (
                <div
                  key={clsKey}
                  className="p-3 rounded-xl bg-background border border-border/70 space-y-2 text-center"
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="uppercase text-primary font-mono">{clsKey}</span>
                    <span className="text-[10px] text-muted-foreground">
                      Energy inside: <b>{cData.energy_inside_pct}%</b>
                    </span>
                  </div>
                  <div className="relative aspect-square rounded-lg overflow-hidden border border-border bg-black/40">
                    <img
                      src={cData.cam_overlay}
                      alt={`Grad-CAM for ${clsKey}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Attribution for class <b>{clsKey.toUpperCase()}</b> at `encoder._conv_head`.
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No comparison data available for this analysis.
            </div>
          )}
        </div>
      ) : (
        /* Views A–E Single Canvas Viewport */
        <div className="relative w-full overflow-hidden rounded-2xl bg-black/5 dark:bg-black/50 flex items-center justify-center border border-border min-h-[260px]">
          <div
            style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.2s ease-out' }}
            className="w-full flex items-center justify-center"
          >
            {activeView === 'view_d_boundary' ? (
              <canvas
                ref={canvasRef}
                className="w-full h-auto max-h-[460px] object-contain"
                aria-label="Dermoscopy image with annotated U-Net boundary contour"
              />
            ) : activeView === 'view_c_overlay' ? (
              <div className="relative w-full h-auto max-h-[460px] flex items-center justify-center">
                {/* Base clean image */}
                <img
                  src={images?.clean || previewUrl}
                  alt="Base dermoscopy image"
                  className="w-full h-auto max-h-[460px] object-contain"
                />
                {/* Heatmap overlay with opacity */}
                <img
                  src={classXaiData?.[selectedClass]?.raw_cam || images?.raw_cam || images?.cam_overlay || displayImageSrc}
                  alt={`Grad-CAM heatmap for ${activeTargetClass}`}
                  style={{ opacity: opacity }}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-screen"
                />
              </div>
            ) : (
              <img
                src={displayImageSrc}
                alt={`OptiDerma diagnostic view: ${activeView}`}
                className="w-full h-auto max-h-[460px] object-contain"
              />
            )}
          </div>

          {/* Target class badge watermark */}
          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 text-[10px] font-mono text-white flex items-center gap-1.5 shadow-md">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            <span>Target: <b>{activeTargetClass.toUpperCase()}</b></span>
            <span className="text-white/50">|</span>
            <span className="capitalize">{activeView.replace('view_', '').replace('_', ' ')}</span>
          </div>

          {/* View E: Spatial Energy Diagnostic Badge Overlay */}
          {activeView === 'view_e_comparison' && xai && (
            <div className="absolute bottom-2.5 left-2.5 right-2.5 p-3 rounded-xl bg-background/95 backdrop-blur-md border border-border text-xs space-y-1.5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles size={13} className="text-primary" />
                  Spatial Attribution Energy Localization
                </span>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded-md text-[10px] ${
                    (xai.energy_inside_pct ?? 0) > 40
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                  }`}
                >
                  {xai.energy_inside_pct ?? 'N/A'}% inside lesion mask
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] pt-0.5">
                <div>
                  <span className="text-muted-foreground block">Mean Inside:</span>
                  <span className="font-mono font-semibold">{xai.mean_attribution_inside}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Mean Outside:</span>
                  <span className="font-mono font-semibold">{xai.mean_attribution_outside}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Spatial Ratio:</span>
                  <span className="font-mono font-semibold">{xai.spatial_ratio}x</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                *Exploratory spatial diagnostic metric. High background activation does not invalidate deep features, but documents attribution bleed.
              </p>
            </div>
          )}

          {/* View G: DullRazor Inpainted Image Badge Overlay */}
          {activeView === 'view_g_dullrazor' && (
            <div className="absolute bottom-2.5 left-2.5 right-2.5 p-3 rounded-xl bg-background/95 backdrop-blur-md border border-border text-xs space-y-1.5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <Scissors size={13} className="text-primary" />
                  DullRazor Telea Artifact Inpainting
                </span>
                <span className="font-mono font-bold px-2 py-0.5 rounded-md text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {hairRemoval?.hair_detected
                    ? `${hairRemoval.detected_strands || 0} Strands Cleaned`
                    : 'Clean Image (No Hair Artifact)'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] pt-0.5">
                <div>
                  <span className="text-muted-foreground block">Strands Removed:</span>
                  <span className="font-mono font-semibold">{hairRemoval?.detected_strands ?? 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Hair Pixels:</span>
                  <span className="font-mono font-semibold">{hairRemoval?.hair_pixel_count ?? 0} px</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Reconstruction PSNR:</span>
                  <span className="font-mono font-semibold">
                    {hairRemoval?.psnr_diff && hairRemoval.psnr_diff < 900 ? `${hairRemoval.psnr_diff} dB` : 'Preserved (inf)'}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                *Multi-directional morphological black-hat filtering suppresses hair artifacts while strictly preserving border contours and lesion pigment networks.
              </p>
            </div>
          )}

          {/* View H: Isolated Hair Mask Badge Overlay */}
          {activeView === 'view_h_hair_mask' && (
            <div className="absolute bottom-2.5 left-2.5 right-2.5 p-3 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-xs space-y-1.5 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Eye size={13} className="text-sky-400" />
                  Isolated Binary Hair Mask (Morphological Black-Hat)
                </span>
                <span className="font-mono font-bold px-2 py-0.5 rounded-md text-[10px] bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  {hairRemoval?.hair_detected
                    ? `${hairRemoval.hair_coverage_pct ?? 0}% Coverage`
                    : '0% Hair Coverage'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] pt-0.5">
                <div>
                  <span className="text-slate-400 block font-medium">Mask Polarity:</span>
                  <span className="font-mono font-semibold text-slate-200">White = Hair, Black = Skin</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Mean Strand Length:</span>
                  <span className="font-mono font-semibold text-slate-200">{hairRemoval?.mean_strand_length ?? 0} px</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Algorithm:</span>
                  <span className="font-mono font-semibold text-slate-200">OpenCV Telea + Multi-Scale</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                {hairRemoval?.hair_detected
                  ? 'Isolated hair strands detected across linear directional kernels. Non-hair mole structures were topologically excluded.'
                  : 'Zero overlying hair strands detected. The mask is completely black because the skin lesion is clear of hair.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Scientific Legend & Epistemic Disclaimer */}
      <div className="w-full p-3 rounded-xl bg-muted/40 border border-border/80 text-[11px] text-foreground/80 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <Info size={13} className="text-primary" />
            <span>Grad-CAM Scientific Interpretation Guide</span>
          </div>
          <button
            type="button"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="text-[10px] font-semibold text-primary hover:underline"
          >
            {showTechnicalDetails ? 'Hide Technical Spec' : 'Show Technical Spec'}
          </button>
        </div>
        <p className="leading-relaxed">
          Grad-CAM highlights relative convolutional feature attribution for target class <b>{activeTargetClass.toUpperCase()}</b>.
          Warmer red/yellow colors indicate image regions positively weighting the classification score.
          <b> Important:</b> Saliency maps do not constitute lesion segmentation, do not confirm histopathological malignancy, and cannot prove clinical ground-truth.
        </p>

        {/* Expandable Technical Audit Drawer */}
        {showTechnicalDetails && (
          <div className="pt-2 mt-2 border-t border-border/60 space-y-1 text-[10px] font-mono text-foreground/80">
            <div>Target Layer: <span className="text-primary">{xai?.target_layer || 'encoder._conv_head (f4, 448ch, 8x8)'}</span></div>
            <div>Model Checkpoint: <span className="text-primary">{xai?.checkpoint_hash || '006a77b02a'}</span> (EfficientNet-B4 + U-Net)</div>
            <div>Image Hash (SHA-256): <span className="text-muted-foreground">{xai?.image_fingerprint ? xai.image_fingerprint.slice(0, 24) + '…' : 'Canonical'}</span></div>
            {xai?.warnings && xai.warnings.length > 0 && (
              <div className="pt-1 text-amber-600 dark:text-amber-400">
                Warnings: {xai.warnings.join('; ')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
