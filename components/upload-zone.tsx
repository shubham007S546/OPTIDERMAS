'use client'

import React, { useRef, useState } from 'react'
import { Camera, FileUp, Info, ShieldAlert, ShieldCheck, UploadCloud } from 'lucide-react'

interface UploadZoneProps {
  onFileSelect: (file: File) => void
  hasConsented: boolean
  onConsentChange: (consented: boolean) => void
  disabled?: boolean
  className?: string
}

export function UploadZone({
  onFileSelect,
  hasConsented,
  onConsentChange,
  disabled = false,
  className = '',
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const validateAndHandle = (file?: File | null) => {
    setValidationError(null)
    if (!file) return

    if (!hasConsented) {
      setValidationError('Please review and check the research consent box before uploading.')
      return
    }

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
      {/* Research Consent Checkbox */}
      <div className="p-3.5 rounded-xl border border-border/70 bg-card/80 flex items-start gap-3 text-xs leading-relaxed">
        <input
          id="research-consent-checkbox"
          type="checkbox"
          checked={hasConsented}
          onChange={(e) => {
            onConsentChange(e.target.checked)
            if (e.target.checked) setValidationError(null)
          }}
          disabled={disabled}
          className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
        />
        <label htmlFor="research-consent-checkbox" className="text-foreground cursor-pointer select-none">
          <span className="font-semibold text-foreground">Research Consent: </span>
          I understand this is an investigational research prototype, not a medical device or diagnosis.
          My image is transmitted securely for live inference and is <span className="font-semibold underline">not stored or logged</span>.
        </label>
      </div>

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
        onClick={() => {
          if (!hasConsented) {
            setValidationError('Please review and check the research consent box before uploading.')
          } else {
            fileInputRef.current?.click()
          }
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!hasConsented) {
              setValidationError('Please review and check the research consent box before uploading.')
            } else {
              fileInputRef.current?.click()
            }
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
            onClick={() => {
              if (!hasConsented) {
                setValidationError('Please review and check the research consent box before uploading.')
              } else {
                fileInputRef.current?.click()
              }
            }}
            disabled={disabled}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors shadow-2xs"
          >
            <FileUp className="size-3.5" />
            Browse Files
          </button>
          <button
            type="button"
            onClick={() => {
              if (!hasConsented) {
                setValidationError('Please review and check the research consent box before uploading.')
              } else {
                cameraInputRef.current?.click()
              }
            }}
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

      {/* Dermoscopy and Red-flag Clinical Guidance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl border border-border/70 bg-card/60 flex items-start gap-2.5">
          <Info className="size-4 shrink-0 text-primary mt-0.5" />
          <p className="text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Dermoscopy Notice: </span>
            Trained on dermoscopy images. Ordinary phone photos can give unreliable results.
          </p>
        </div>
        <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-2.5">
          <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <p className="text-amber-900 dark:text-amber-200 leading-relaxed">
            <span className="font-semibold">Red Flag Symptoms: </span>
            See a doctor promptly if a lesion bleeds, grows, changes colour or shape, itches, or hurts.
          </p>
        </div>
      </div>
    </div>
  )
}
