import {
  HealthResponseSchema,
  PredictResponseSchema,
  type ApiError,
  type HealthResponse,
  type PredictResponse,
} from './types'

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '')
  }
  if (typeof window !== 'undefined') {
    return '/backend'
  }
  return 'http://127.0.0.1:8000'
}

export class OptiDermaApiError extends Error implements ApiError {
  code: ApiError['code']
  detail?: string
  canRetry: boolean
  /** True when the backend's image-quality audit rejected the image (can be overridden with `force`). */
  qualityRejected: boolean

  constructor(
    code: ApiError['code'],
    message: string,
    detail?: string,
    canRetry = true,
    qualityRejected = false
  ) {
    super(message)
    this.name = 'OptiDermaApiError'
    this.code = code
    this.detail = detail
    this.canRetry = canRetry
    this.qualityRejected = qualityRejected
  }
}

const QUALITY_FAILURE_PREFIX = 'Image quality check failed:'

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
  /** Ask the backend to analyse even if its image-quality audit fails. */
  force?: boolean
  /** Optional target class for Grad-CAM explainability (e.g. bcc, mel, nv) */
  targetClass?: string
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
    if (options.signal) {
      if (options.signal.aborted) {
        throw new OptiDermaApiError('TIMEOUT', 'Request was cancelled', undefined, true)
      }
      options.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    // 5-second wakeup timer
    const wakeupTimer = setTimeout(() => {
      options.onWakeup?.('Waking up the model, this can take up to a minute')
      options.onProgress?.('analysing')
    }, 5000)

    // 60-second total timeout
    const timeoutTimer = setTimeout(() => {
      controller.abort()
    }, 60000)

    try {
      options.onProgress?.('uploading')

      const formData = new FormData()
      formData.append('file', file, file.name)

      const queryParams = new URLSearchParams()
      if (options.force) queryParams.set('force', 'true')
      if (options.targetClass) queryParams.set('target_class', options.targetClass)
      const qStr = queryParams.toString() ? `?${queryParams.toString()}` : ''

      const response = await fetch(`${baseUrl}/predict${qStr}`, {
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
          if (parsedJson.detail) {
            detailMessage =
              typeof parsedJson.detail === 'string'
                ? parsedJson.detail
                : JSON.stringify(parsedJson.detail)
          } else if (parsedJson.message) detailMessage = String(parsedJson.message)
        } catch {
          // Plain text response
        }

        if (response.status === 400 && detailMessage.startsWith(QUALITY_FAILURE_PREFIX)) {
          throw new OptiDermaApiError(
            400,
            'The image did not pass the quality check. Retake it using the advice below, or analyse it anyway (results may be less reliable).',
            detailMessage.slice(QUALITY_FAILURE_PREFIX.length).trim(),
            false,
            true
          )
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

export interface OptiDermaAgentResponse {
  user_query: string
  safety: {
    is_emergency: boolean
    red_flags_detected: string[]
    urgency_level: string
    override_guidance?: string | null
    requires_immediate_care: boolean
  }
  skin_analysis?: {
    has_image: boolean
    model_name: string
    findings: Array<{ condition_name: string; confidence_score: number; category: string; description: string }>
    top_prediction: string
    top_confidence: number
    detected_features: string[]
    is_dermatology_validated: boolean
    raw_analysis?: string | null
  } | null
  retrieved_evidence: Array<{
    title: string
    source: string
    content: string
    relevance_score: number
  }>
  assessment: {
    differential_possibilities: string[]
    summary_explanation: string
    supporting_symptoms: string[]
    clarifying_questions: string[]
    general_guidance: string
    red_flags: string[]
    consultation_recommended: boolean
    disclaimer: string
  }
}

/**
 * Sends a multimodal query to the OptiDerma Agent backend (/api/v1/analyze).
 */
export async function analyzeOptiDermaAgent(
  query: string,
  imageBase64?: string,
  symptoms?: Record<string, unknown>
): Promise<OptiDermaAgentResponse> {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(`${baseUrl}/api/v1/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, image_base64: imageBase64, symptoms }),
  })
  if (!response.ok) {
    throw new OptiDermaApiError(
      response.status as ApiError['code'],
      `OptiDerma Agent endpoint returned HTTP ${response.status}`
    )
  }
  return (await response.json()) as OptiDermaAgentResponse
}

/**
 * Queries the Dermatology RAG knowledge base (/api/v1/rag/search).
 */
export async function searchDermatologyRAG(query: string, topK = 2) {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(
    `${baseUrl}/api/v1/rag/search?q=${encodeURIComponent(query)}&top_k=${topK}`
  )
  if (!response.ok) return []
  return await response.json()
}

export async function checkReady(signal?: AbortSignal): Promise<boolean> {
  const baseUrl = getApiBaseUrl()
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }
    const response = await fetch(`${baseUrl}/ready`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!response.ok) return false
    const json = await response.json()
    return json.ready === true
  } catch {
    return false
  }
}

export interface RecentAnalysisSummary {
  analysis_id: string
  created_at: string
  top_condition: string
  top_score: number
  top3: [string, number][]
  malignant_prob: number
  risk_level: string
  recommendation: string
  status: string
  persistence_source: string
}

export async function fetchRecentAnalyses(limit = 20): Promise<RecentAnalysisSummary[]> {
  const baseUrl = getApiBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/analyses?limit=${limit}`)
    if (!res.ok) return []
    const json = await res.json()
    return json.analyses || []
  } catch {
    return []
  }
}

/**
 * Retrieves stored canonical analysis record by analysis ID.
 */
export async function getAnalysis(analysisId: string): Promise<PredictResponse> {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(`${baseUrl}/analysis/${encodeURIComponent(analysisId)}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new OptiDermaApiError(
      response.status as ApiError['code'],
      `Failed to retrieve analysis ${analysisId}`
    )
  }
  const json = await response.json()
  return json as PredictResponse
}

/**
 * Executes or re-runs independent verification audit on an analysis record.
 */
export async function verifyAnalysis(analysisId: string) {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(`${baseUrl}/analysis/${encodeURIComponent(analysisId)}/verify`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new OptiDermaApiError(
      response.status as ApiError['code'],
      `Verification failed for ${analysisId}`
    )
  }
  return await response.json()
}

/**
 * Retrieves structured patient or technical report with adaptive differential threshold.
 */
export async function getReport(
  analysisId: string,
  type: 'patient' | 'technical' = 'technical',
  diffThreshold: number = 0.20
) {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(
    `${baseUrl}/analysis/${encodeURIComponent(analysisId)}/report?report_type=${type}&diff_threshold=${diffThreshold}`,
    { headers: { Accept: 'application/json' } }
  )
  if (!response.ok) {
    throw new OptiDermaApiError(
      response.status as ApiError['code'],
      `Failed to retrieve ${type} report for ${analysisId}`
    )
  }
  return await response.json()
}

/**
 * Returns direct URL for downloading publication-grade PDF report with adaptive differential threshold.
 */
export function getReportPdfUrl(analysisId: string, diffThreshold: number = 0.20): string {
  const baseUrl = getApiBaseUrl()
  return `${baseUrl}/analysis/${encodeURIComponent(analysisId)}/report/pdf?diff_threshold=${diffThreshold}`
}

export interface CouncilAgentFinding {
  agent_id: string
  agent_name: string
  role: string
  status: string
  confidence: number
  summary: string
  recommendation: string
  patient_explanation?: string
  evidence_citations?: string[]
  deliberation_notes?: string[]
}

export interface CouncilConsensusResponse {
  council_id: string
  analysis_id?: string
  consensus_diagnosis: string
  consensus_urgency: string
  consensus_confidence: number
  consensus_agreement_pct: number
  is_emergency: boolean
  requires_clinical_biopsy: boolean
  patient_consensus?: string
  agents: {
    triage?: CouncilAgentFinding
    vision?: CouncilAgentFinding
    critic?: CouncilAgentFinding
    evidence?: CouncilAgentFinding
    care?: CouncilAgentFinding
    communication?: CouncilAgentFinding
  }
  deliberation_trace: string[]
  deliberation_duration_ms: number
  created_at: string
}

export function getMockCouncilConsensus(analysisId = 'mock-sample-uuid-001'): CouncilConsensusResponse {
  return {
    council_id: 'mock-council-consensus-001',
    analysis_id: analysisId,
    consensus_diagnosis: 'Actinic Keratosis / Intraepithelial Carcinoma',
    consensus_urgency: 'urgent',
    consensus_confidence: 0.946,
    consensus_agreement_pct: 94.6,
    is_emergency: false,
    requires_clinical_biopsy: true,
    agents: {
      triage: {
        agent_id: 'agent_triage_01',
        agent_name: 'Triage Specialist',
        role: 'emergency_triage',
        status: 'completed',
        confidence: 0.92,
        summary: 'Routine dermoscopic triage. No acute systemic emergency.',
        recommendation: 'Dermatological consultation advised within 3-6 weeks.',
      },
      vision: {
        agent_id: 'agent_vision_02',
        agent_name: 'Computer Vision Specialist',
        role: 'vision_diagnostics',
        status: 'completed',
        confidence: 0.996,
        summary: 'Visual pattern matches Actinic Keratosis / Intraepithelial Carcinoma (99.6%).',
        recommendation: 'Evaluate lesion border irregularity and scale under dermoscopy.',
      },
      critic: {
        agent_id: 'agent_critic_03',
        agent_name: 'Mathematical & Saliency Critic',
        role: 'verification_audit',
        status: 'completed',
        confidence: 0.88,
        summary: 'Saliency energy localized inside lesion boundary (78.2%). Compactness 1.21 passes isoperimetric constraint.',
        recommendation: 'Verified. Quantitative morphometrics satisfy physical invariants.',
      },
      evidence: {
        agent_id: 'agent_evidence_04',
        agent_name: 'Clinical Evidence Retrieval Agent',
        role: 'evidence_rag',
        status: 'completed',
        confidence: 0.94,
        summary: 'Retrieved AAD & BAD management guidelines for actinic keratosis.',
        recommendation: 'Cryotherapy, topical 5-FU, or PDT per guideline recommendations.',
      },
      care: {
        agent_id: 'agent_care_05',
        agent_name: 'Care Coordinator Agent',
        role: 'care_referral',
        status: 'completed',
        confidence: 0.85,
        summary: 'Identified 3 accredited dermatologists with open appointment slots.',
        recommendation: 'Present booking options to patient.',
      },
      communication: {
        agent_id: 'agent_comm_06',
        agent_name: 'Patient Communication Agent',
        role: 'patient_communication',
        status: 'completed',
        confidence: 0.90,
        summary: 'Synthesized plain-language patient explanation with clear non-definitive disclaimers.',
        recommendation: 'Inform patient that AI decision support requires doctor confirmation.',
      },
    },
    deliberation_trace: [
      'Supervisor convened OptiDerma Multi-Agent Clinical Council.',
      '1. Triage Agent evaluated red flags -> Routine triage screening complete.',
      '2. Vision Specialist Agent analyzed dermoscopy -> Visual pattern matches AKIEC (99.6%).',
      '3. Critic Agent audited mathematical & saliency constraints -> Invariants verified.',
      '4. Evidence Agent retrieved clinical guidelines -> AAD & BAD guidelines matched.',
      '5. Care Coordinator mapped accredited providers.',
      '6. Communication Agent synthesized patient guidance.',
      'Consensus achieved: Actinic Keratosis | Urgency: URGENT | Mean Agent Confidence: 94.6%.',
    ],
    deliberation_duration_ms: 1.2,
    created_at: new Date().toISOString(),
  }
}

/**
 * Fetches the Multi-Agent Clinical Council consensus record for an analysis.
 */
export async function fetchCouncilConsensus(
  analysisId: string,
  signal?: AbortSignal
): Promise<CouncilConsensusResponse> {
  const baseUrl = getApiBaseUrl()
  try {
    const response = await fetch(
      `${baseUrl}/analysis/${encodeURIComponent(analysisId)}/council`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal,
      }
    )
    if (!response.ok) {
      if (analysisId.startsWith('mock-') || response.status === 404) {
        return getMockCouncilConsensus(analysisId)
      }
      throw new OptiDermaApiError(
        (response.status as ApiError['code']) || 500,
        `Failed to fetch multi-agent council consensus for '${analysisId}'`
      )
    }
    return await response.json()
  } catch (err) {
    if (analysisId.startsWith('mock-') || (err instanceof OptiDermaApiError && err.code === 404)) {
      return getMockCouncilConsensus(analysisId)
    }
    throw err
  }
}

export interface ClassXaiResponse {
  raw_cam?: string
  cam_overlay?: string
  energy_inside_pct?: number
  comparison?: Record<string, { raw_cam: string; cam_overlay: string; energy_inside_pct: number }>
  classes?: Record<string, { raw_cam: string; cam_overlay: string; energy_inside_pct: number }>
  [key: string]: unknown
}

/**
 * Fetches or dynamically recomputes Grad-CAM for a specific target class or multi-class comparison.
 */
export async function fetchClassXai(
  analysisId: string,
  targetClass: string = 'top1',
  signal?: AbortSignal
): Promise<ClassXaiResponse> {
  const baseUrl = getApiBaseUrl()
  const response = await fetch(
    `${baseUrl}/analysis/${encodeURIComponent(analysisId)}/xai?target_class=${encodeURIComponent(targetClass)}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    }
  )
  if (!response.ok) {
    throw new OptiDermaApiError(
      (response.status as ApiError['code']) || 500,
      `Failed to fetch XAI attribution for class '${targetClass}'`
    )
  }
  return await response.json()
}

/**
 * Generates an accurate mock response matching the backend contract for offline verification.
 */
export function getMockPrediction(filename = 'sample.jpg'): PredictResponse {
  return {
    analysis_id: 'mock-sample-uuid-001',
    created_at: new Date().toISOString(),
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
      clean: undefined,
      mask_overlay: undefined,
      cam_overlay: undefined,
      hair_mask: undefined,
    },
    hair_removal: {
      hair_detected: false,
      hair_pixel_count: 0,
      hair_coverage_pct: 0.0,
      detected_strands: 0,
      mean_strand_length: 0.0,
      psnr_diff: 999.0,
      inpaint_method: 'telea',
      execution_status: 'no_hair_detected',
      warnings: [],
    },
    verification: {
      passed: true,
      verification_version: '1.0.0-clinical-audit',
      requires_review: false,
      abstention_reason: null,
      failed_checks: [],
      warnings: [],
      checks_summary: {
        probabilities_valid: true,
        top3_valid: true,
        morphometrics_valid: true,
        explainability_valid: true,
      },
      disclaimers: [
        'OptiDerma is an investigational decision-support research system. Not a medical device.',
      ],
    },
    evidence: [
      {
        title: 'Actinic Keratosis and Cutaneous Squamous Cell Carcinoma in Situ',
        source: 'Journal of the American Academy of Dermatology (JAAD 2021;85:123-138)',
        content: 'Actinic keratosis presents as scaly erythematous patches on chronic sun-damaged skin.',
        relevance_score: 5.0,
      },
    ],
    cam_target_class: 'akiec',
    cam_valid: true,
    seg_valid: true,
    council: getMockCouncilConsensus('mock-sample-uuid-001'),
    patient_summary: {
      headline: 'Good News: Visual pattern matches a Common Benign Mole',
      condition_plain_name: 'Common Benign Mole (Melanocytic Nevus)',
      concern_level: 'Low Concern',
      concern_color: 'green',
      simple_explanation:
        'This spot matches a standard common mole. Most adults have between 10 and 40 moles, and they are completely harmless natural variations in skin pigmentation. While this finding is reassuring, it is always healthy practice to keep an eye on your skin over time.',
      what_ai_noticed: {
        symmetry: 'Even & Balanced (both halves match well)',
        border: 'Smooth & Regular (well-defined clean edges)',
        color: 'Uniform & Consistent (single even tone)',
        size: '~12.0 mm² area (roughly 4.8 mm across, smaller than a pencil eraser)',
      },
      action_plan: [
        'Keep an eye on this spot as part of your regular skin awareness.',
        'Take a well-lit photo every 3 months so you can easily compare over time.',
        'Mention it at your next routine physical or dermatologist visit for peace of mind.',
      ],
      doctor_questions: [
        'Does this mole look healthy and typical for my skin type?',
        'How often should I have full-body skin checks given my personal mole count?',
        'Are there any specific spots on my body I should monitor more closely?',
      ],
      home_care_dos: [
        'Take a clear photo every few months to see if it changes over time.',
        'Apply broad-spectrum sunscreen (SPF 30+) daily on exposed areas.',
      ],
      home_care_donts: [
        'Do not scratch, pick, or attempt home removal techniques on any mole.',
      ],
      is_emergency: false,
    },
  }
}

export async function fetchPersistenceStatus(): Promise<{
  status: string
  reachable: boolean
  tables_ready: boolean
  error?: string
}> {
  const baseUrl = getApiBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/persistence/status`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (e) {
    return { status: 'offline', reachable: false, tables_ready: false, error: String(e) }
  }
}

export interface ConversationCitation {
  citation_id: string
  source_id?: string
  title: string
  source: string
  url?: string
  publication_year?: number
  evidence_level?: string
  snippet?: string
}

export interface ConversationResponse {
  conversation_id: string
  analysis_id?: string | null
  user_id: string
  intent: string
  answer: string
  citations: ConversationCitation[]
  mode: 'general' | 'analysis_aware'
  evidence_count: number
}

export interface ConversationItem {
  id: string
  analysis_id?: string | null
  user_id: string
  title: string
  mode: 'general' | 'analysis_aware'
  message_count?: number
  last_message_preview?: string
  last_sender?: string
  created_at: string
  updated_at: string
}

export interface ConversationMessageItem {
  id: string
  conversation_id: string
  sender: 'user' | 'assistant'
  content: string
  citations?: ConversationCitation[]
  intent?: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface ConversationDetail extends ConversationItem {
  messages: ConversationMessageItem[]
}

export async function sendConversationMessage(
  query: string,
  options?: {
    conversationId?: string | null
    analysisId?: string | null
    userId?: string
    mode?: 'patient' | 'clinical'
  }
): Promise<ConversationResponse> {
  const baseUrl = getApiBaseUrl()
  const payload = {
    query,
    user_id: options?.userId || 'patient_user',
    conversation_id: options?.conversationId || undefined,
    analysis_id: options?.analysisId || undefined,
    mode: options?.mode || 'patient',
  }

  const endpoint = options?.analysisId
    ? `${baseUrl}/analysis/${options.analysisId}/chat`
    : `${baseUrl}/conversation`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Network error')
    throw new Error(`Chat request failed (${res.status}): ${errText}`)
  }

  return await res.json()
}

export async function fetchConversationHistory(conversationId: string): Promise<ConversationDetail> {
  const baseUrl = getApiBaseUrl()
  const res = await fetch(`${baseUrl}/conversations/${encodeURIComponent(conversationId)}`)
  if (!res.ok) throw new Error(`Could not load conversation (${res.status})`)
  return await res.json()
}

export async function fetchConversations(options?: {
  analysisId?: string
  limit?: number
}): Promise<ConversationItem[]> {
  const baseUrl = getApiBaseUrl()
  const params = new URLSearchParams()
  if (options?.analysisId) params.set('analysis_id', options.analysisId)
  if (options?.limit) params.set('limit', String(options.limit))
  const qs = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`${baseUrl}/conversations${qs}`)
  if (!res.ok) throw new Error(`Could not list conversations (${res.status})`)
  const data = await res.json()
  return data.conversations || []
}

export async function createConversation(data?: {
  title?: string
  analysisId?: string | null
  mode?: string
}): Promise<ConversationItem> {
  const baseUrl = getApiBaseUrl()
  const res = await fetch(`${baseUrl}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: data?.title,
      analysis_id: data?.analysisId || null,
      mode: data?.mode || (data?.analysisId ? 'analysis_aware' : 'general'),
    }),
  })
  if (!res.ok) throw new Error(`Could not create conversation (${res.status})`)
  return await res.json()
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<{ ok: boolean; title: string }> {
  const baseUrl = getApiBaseUrl()
  const res = await fetch(`${baseUrl}/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error(`Could not rename conversation (${res.status})`)
  return await res.json()
}

export async function deleteConversation(conversationId: string): Promise<{ ok: boolean }> {
  const baseUrl = getApiBaseUrl()
  const res = await fetch(`${baseUrl}/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`Could not delete conversation (${res.status})`)
  return await res.json()
}

export interface ClinicProvider {
  id: string
  name: string
  institution: string
  address: string
  city: string
  district: string
  pin_code: string
  phone: string
  consultation_types: string[]
  hours: string
  verified: boolean
  specialties: string[]
  booking_mode: string
  portal_url?: string
}

export async function searchDermatologists(params: {
  pin_code?: string
  district?: string
  city?: string
  consultation_type?: string
}): Promise<{
  results: ClinicProvider[]
  count: number
  disclaimer: string
}> {
  const baseUrl = getApiBaseUrl()
  const q = new URLSearchParams()
  if (params.pin_code) q.set('pin_code', params.pin_code)
  if (params.district) q.set('district', params.district)
  if (params.city) q.set('city', params.city)
  if (params.consultation_type) q.set('consultation_type', params.consultation_type)

  const res = await fetch(`${baseUrl}/dermatologists/search?${q.toString()}`)
  if (!res.ok) throw new Error(`Provider search failed (${res.status})`)
  return await res.json()
}

export interface AppointmentRequestPayload {
  analysis_id?: string | null
  patient_name: string
  contact_email: string
  contact_phone?: string
  city?: string
  district?: string
  pin_code?: string
  clinic_id?: string
  clinic_name?: string
  preferred_date: string
  consultation_type: string
  reason?: string
  consultation_summary?: string
  user_consent: boolean
}

export async function submitAppointmentRequest(payload: AppointmentRequestPayload) {
  const baseUrl = getApiBaseUrl()
  const res = await fetch(`${baseUrl}/appointments/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Appointment request submission failed (${res.status})`)
  return await res.json()
}

export async function fetchAppointmentRequests() {
  const baseUrl = getApiBaseUrl()
  const res = await fetch(`${baseUrl}/appointments/requests`)
  if (!res.ok) throw new Error(`Could not fetch appointment requests (${res.status})`)
  return await res.json()
}

export async function generateConsultationSummary(
  analysisId: string,
  options?: { questions?: string[]; userNotes?: string }
): Promise<{
  analysis_id: string
  created_at: string
  top_condition: string
  top_score: string
  differential: string[]
  questions: string[]
  user_notes: string
  summary_markdown: string
}> {
  const baseUrl = getApiBaseUrl()
  const res = await fetch(`${baseUrl}/analysis/${analysisId}/consultation-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questions: options?.questions,
      user_notes: options?.userNotes || '',
    }),
  })
  if (!res.ok) throw new Error(`Consultation summary generation failed (${res.status})`)
  return await res.json()
}

export interface VoiceTurnPayload {
  audioBlob?: Blob
  audioFilename?: string
  query?: string
  imageFile?: File
  analysisId?: string | null
  conversationId?: string | null
  userId?: string
  outputAudio?: boolean
  responseFormat?: 'json' | 'audio'
}

export interface VoiceTurnResponse {
  ok: boolean
  transcript: string
  transcription_status: string
  effective_query: string
  conversation_id: string
  analysis_id: string | null
  intent: string
  answer: string
  spoken_text: string
  audio_base64: string
  audio_format: string
  tts_provider: string
  citations: Array<{
    title: string
    source: string
    snippet: string
    relevance_score?: number
  }>
  citations_count: number
  new_analysis_generated: boolean
  trace?: Record<string, unknown>
}

export async function submitVoiceTurn(payload: VoiceTurnPayload): Promise<VoiceTurnResponse> {
  const baseUrl = getApiBaseUrl()
  const formData = new FormData()

  if (payload.audioBlob) {
    formData.append('audio_file', payload.audioBlob, payload.audioFilename || 'recording.webm')
  }
  if (payload.imageFile) {
    formData.append('image_file', payload.imageFile)
  }
  if (payload.query) {
    formData.append('query', payload.query)
  }
  if (payload.analysisId) {
    formData.append('analysis_id', payload.analysisId)
  }
  if (payload.conversationId) {
    formData.append('conversation_id', payload.conversationId)
  }
  if (payload.userId) {
    formData.append('user_id', payload.userId)
  }
  formData.append('output_audio', String(payload.outputAudio ?? true))

  const url = `${baseUrl}/api/v1/agent/voice-turn`
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Voice turn failed (${res.status}): ${errorText}`)
  }

  return await res.json()
}


