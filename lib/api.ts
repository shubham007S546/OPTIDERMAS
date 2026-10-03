import {
  HealthResponseSchema,
  PredictResponseSchema,
  type ApiError,
  type HealthResponse,
  type PredictResponse,
} from './types'

export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  return url.replace(/\/+$/, '')
}

export class OptiDermaApiError extends Error implements ApiError {
  code: ApiError['code']
  detail?: string
  canRetry: boolean

  constructor(code: ApiError['code'], message: string, detail?: string, canRetry = true) {
    super(message)
    this.name = 'OptiDermaApiError'
    this.code = code
    this.detail = detail
    this.canRetry = canRetry
  }
}

export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  const baseUrl = getApiBaseUrl()
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) return false
    const json = await response.json()
    const parsed = HealthResponseSchema.safeParse(json)
    return parsed.success && parsed.data.ok === true
  } catch {
    return false
  }
}

interface PredictOptions {
  signal?: AbortSignal
  onWakeup?: (message: string) => void
  onProgress?: (stage: 'uploading' | 'analysing') => void
}

/**
 * Predicts skin lesion characteristics using the model backend.
 * - NEVER resizes, compresses, crops, or re-encodes the image.
 * - Enforces 60-second request timeout.
 * - Triggers a wakeup notice if response takes > 5 seconds.
 * - Performs exactly one retry on network failure.
 */
export async function predictLesion(
  file: File,
  options: PredictOptions = {}
): Promise<PredictResponse> {
  const baseUrl = getApiBaseUrl()

  // Validate size client-side first
  if (file.size > 20 * 1024 * 1024) {
    throw new OptiDermaApiError(
      413,
      'Image file is too large (exceeds 20 MB). Please choose an image smaller than 20 MB.',
      undefined,
      false
    )
  }

  // Validate accepted MIME types
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
  if (!validTypes.includes(file.type.toLowerCase())) {
    throw new OptiDermaApiError(
      400,
      'Unsupported image format. Please upload a JPG, PNG, or WEBP dermoscopy image.',
      undefined,
      false
    )
  }

  const executeAttempt = async (isRetry = false): Promise<PredictResponse> => {
    const controller = new AbortController()
    let wakeupTimer: ReturnType<typeof setTimeout> | null = null
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null

    // Connect external signal if provided
    if (options.signal) {
      if (options.signal.aborted) {
        throw new OptiDermaApiError('TIMEOUT', 'Request was cancelled', undefined, true)
      }
      options.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    // 5-second wakeup timer
    wakeupTimer = setTimeout(() => {
      options.onWakeup?.('Waking up the model, this can take up to a minute')
      options.onProgress?.('analysing')
    }, 5000)

    // 60-second total timeout
    timeoutTimer = setTimeout(() => {
      controller.abort()
    }, 60000)

    try {
      options.onProgress?.('uploading')

      const formData = new FormData()
      // Send raw uncompressed bytes directly to server
      formData.append('file', file, file.name)

      const response = await fetch(`${baseUrl}/predict`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      if (wakeupTimer) clearTimeout(wakeupTimer)
      if (timeoutTimer) clearTimeout(timeoutTimer)

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        let detailMessage = errorText
        try {
          const parsedJson = JSON.parse(errorText)
          if (parsedJson.detail) detailMessage = parsedJson.detail
          else if (parsedJson.message) detailMessage = parsedJson.message
        } catch {
          // Plain text response
        }

        if (response.status === 400) {
          throw new OptiDermaApiError(
            400,
            'The inference engine could not process this image. Please ensure the image is a clear, uncorrupted dermoscopic photo.',
            detailMessage,
            false
          )
        }
        if (response.status === 413) {
          throw new OptiDermaApiError(
            413,
            'Image exceeds the server limit of 20 MB.',
            detailMessage,
            false
          )
        }
        if (response.status >= 500) {
          throw new OptiDermaApiError(
            response.status as ApiError['code'],
            'The inference server encountered an internal error. Please try again in a few moments.',
            detailMessage,
            true
          )
        }

        throw new OptiDermaApiError(
          response.status as ApiError['code'],
          `Model server returned HTTP ${response.status}.`,
          detailMessage,
          true
        )
      }

      options.onProgress?.('analysing')
      const json = await response.json()
      const validation = PredictResponseSchema.safeParse(json)

      if (!validation.success) {
        throw new OptiDermaApiError(
          'PARSE_ERROR',
          'Model response format did not match expected structure.',
          JSON.stringify(validation.error.issues),
          false
        )
      }

      return validation.data
    } catch (err: unknown) {
      if (wakeupTimer) clearTimeout(wakeupTimer)
      if (timeoutTimer) clearTimeout(timeoutTimer)

      if (err instanceof OptiDermaApiError) {
        throw err
      }

      // Check if aborted due to timeout
      if (controller.signal.aborted) {
        throw new OptiDermaApiError(
          'TIMEOUT',
          'Request timed out after 60 seconds. The model service took too long to respond.',
          undefined,
          true
        )
      }

      // If it's a network error and we haven't retried yet, perform one retry
      if (!isRetry) {
        // Wait 1.5 seconds before retrying network error
        await new Promise((res) => setTimeout(res, 1500))
        return executeAttempt(true)
      }

      throw new OptiDermaApiError(
        'NETWORK_ERROR',
        `Unable to reach the inference backend at ${baseUrl}. Please check that the server is online.`,
        err instanceof Error ? err.message : String(err),
        true
      )
    }
  }

  return executeAttempt(false)
}

/**
 * Generates an accurate mock response matching the backend contract for offline verification.
 */
export function getMockPrediction(filename = 'sample.jpg'): PredictResponse {
  return {
    probs: {
      akiec: 0.996,
      bcc: 0.003,
      bkl: 0.0005,
      mel: 0.0002,
      nv: 0.0001,
      vasc: 0.0001,
      df: 0.0001,
    },
    top3: [
      ['akiec', 0.996],
      ['bcc', 0.003],
      ['bkl', 0.0005],
    ],
    malignant_flag: true,
    malignant_prob: 0.999,
    risk: {
      level: 'Moderate',
      color: 'amber',
      recommendation:
        'Higher-concern group pattern detected. Schedule a clinical examination with a dermatologist.',
    },
    metrics: {
      area_mm2: 24.8,
      perimeter_mm: 19.4,
      asymmetry_index: 0.38,
      compactness: 1.21,
      coverage_pct: 14.6,
      contour: [
        [104, 96],
        [128, 92],
        [152, 104],
        [168, 128],
        [164, 156],
        [140, 172],
        [112, 168],
        [96, 144],
        [92, 116],
        [104, 96],
      ],
    },
    images: {
      original: undefined,
      mask_overlay: undefined,
      cam_overlay: undefined,
    },
  }
}
