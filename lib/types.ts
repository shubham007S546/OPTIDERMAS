import { z } from 'zod'

export const LESION_CLASSES = ['nv', 'mel', 'bkl', 'bcc', 'akiec', 'vasc', 'df'] as const
export type LesionClass = (typeof LESION_CLASSES)[number]

export const LESION_LABELS: Record<string, { title: string; subtitle: string; description: string }> = {
  nv: {
    title: 'Melanocytic Nevus',
    subtitle: 'Common mole',
    description: 'A typical, usually harmless mole composed of melanocytes.',
  },
  mel: {
    title: 'Melanoma',
    subtitle: 'Higher-concern malignancy',
    description: 'A serious skin malignancy requiring prompt dermatological evaluation.',
  },
  bkl: {
    title: 'Benign Keratosis-like Lesion',
    subtitle: 'Seborrheic keratosis or solar lentigo',
    description: 'A non-cancerous skin growth that frequently occurs with aging.',
  },
  bcc: {
    title: 'Basal Cell Carcinoma',
    subtitle: 'Common skin cancer',
    description: 'The most common form of skin cancer, arising in basal cells.',
  },
  akiec: {
    title: 'Actinic Keratosis / IEC',
    subtitle: 'Intraepithelial carcinoma / pre-cancerous',
    description: 'A rough, scaly patch resulting from prolonged sun exposure.',
  },
  vasc: {
    title: 'Vascular Lesion',
    subtitle: 'Hemangioma or angioma',
    description: 'A benign collection of blood vessels forming a distinct red or purple mark.',
  },
  df: {
    title: 'Dermatofibroma',
    subtitle: 'Benign fibrous nodule',
    description: 'A harmless, firm, small bump often found on the lower legs.',
  },
}

export const RiskSchema = z.object({
  level: z.string(),
  color: z.string(),
  recommendation: z.string(),
})
export type RiskInfo = z.infer<typeof RiskSchema>

export const MetricsSchema = z.object({
  area_px: z.number().optional(),
  perimeter_px: z.number().optional(),
  area_mm2: z.number(),
  perimeter_mm: z.number(),
  is_calibrated: z.boolean().optional(),
  calibration_method: z.string().optional(),
  calibration_disclaimer: z.string().optional(),
  asymmetry_index: z.number(),
  compactness: z.number(),
  coverage_pct: z.number(),
  contour: z.array(z.tuple([z.number(), z.number()])),
})
export type LesionMetrics = z.infer<typeof MetricsSchema>

export const ImagesSchema = z
  .object({
    original: z.string().nullable().optional(),
    clean: z.string().nullable().optional(),
    mask_overlay: z.string().nullable().optional(),
    cam_overlay: z.string().nullable().optional(),
    hair_mask: z.string().nullable().optional(),
    raw_cam: z.string().nullable().optional(),
    seg_mask: z.string().nullable().optional(),
    mask_contour: z.string().nullable().optional(),
    cam_on_clean: z.string().nullable().optional(),
  })
  .optional()
export type LesionImages = z.infer<typeof ImagesSchema>

export const XaiDiagnosticsSchema = z
  .object({
    target_class: z.string(),
    target_idx: z.number(),
    target_logit: z.number().optional(),
    target_prob: z.number().optional(),
    energy_inside_pct: z.number().optional(),
    mean_attribution_inside: z.number().optional(),
    mean_attribution_outside: z.number().optional(),
    spatial_ratio: z.number().optional(),
    target_layer: z.string().optional(),
    checkpoint_hash: z.string().optional(),
    image_fingerprint: z.string().optional(),
    warnings: z.array(z.string()).optional(),
  })
  .optional()
export type XaiDiagnostics = z.infer<typeof XaiDiagnosticsSchema>

export const HairRemovalDiagnosticsSchema = z
  .object({
    hair_detected: z.boolean().optional(),
    hair_pixel_count: z.number().optional(),
    hair_coverage_pct: z.number().optional(),
    detected_strands: z.number().optional(),
    mean_strand_length: z.number().optional(),
    psnr_diff: z.number().optional(),
    inpaint_method: z.string().optional(),
    execution_status: z.string().optional(),
    warnings: z.array(z.string()).optional(),
  })
  .optional()
export type HairRemovalDiagnostics = z.infer<typeof HairRemovalDiagnosticsSchema>

export const VerificationResultSchema = z
  .object({
    passed: z.boolean(),
    verification_version: z.string().optional(),
    requires_review: z.boolean().optional(),
    abstention_reason: z.string().nullable().optional(),
    failed_checks: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
    checks_summary: z.record(z.string(), z.boolean()).optional(),
    disclaimers: z.array(z.string()).optional(),
  })
  .optional()
export type VerificationResult = z.infer<typeof VerificationResultSchema>

export const RAGPassageSchema = z.object({
  title: z.string(),
  source: z.string(),
  content: z.string(),
  relevance_score: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})
export type RAGPassage = z.infer<typeof RAGPassageSchema>

export const PersistenceInfoSchema = z.object({
  persisted: z.boolean().optional(),
  supabase_cloud: z.boolean().optional(),
  local_database: z.boolean().optional(),
  persistence_source: z.string().optional(),
  supabase_health: z.record(z.string(), z.any()).optional(),
}).optional()
export type PersistenceInfo = z.infer<typeof PersistenceInfoSchema>

export const QualityReportSchema = z
  .object({
    width: z.number().optional(),
    height: z.number().optional(),
    sharpness: z.number().optional(),
    mean_brightness: z.number().optional(),
    glare_fraction: z.number().optional(),
    contrast: z.number().optional(),
    passed: z.boolean().optional(),
    issues: z.array(z.string()).optional(),
    advice: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
    is_out_of_distribution: z.boolean().optional(),
    domain_type: z.string().optional(),
  })
  .optional()
export type QualityReport = z.infer<typeof QualityReportSchema>

export const DifferentialStrategySchema = z
  .object({
    mode: z.string(),
    is_single_shown: z.boolean(),
    confidence_delta: z.number(),
    threshold_parameter: z.number(),
    top_confidence: z.number(),
    runner_up_confidence: z.number(),
    active_differentials: z.array(z.tuple([z.string(), z.number()])),
    suppressed_differentials: z.array(z.tuple([z.string(), z.number()])),
    clinical_rationale: z.string(),
  })
  .optional()
export type DifferentialStrategy = z.infer<typeof DifferentialStrategySchema>

export const PatientCareSummarySchema = z
  .object({
    headline: z.string(),
    condition_plain_name: z.string(),
    concern_level: z.string(),
    concern_color: z.string(),
    simple_explanation: z.string(),
    what_ai_noticed: z.record(z.string(), z.string()).optional(),
    action_plan: z.array(z.string()).optional(),
    doctor_questions: z.array(z.string()).optional(),
    home_care_dos: z.array(z.string()).optional(),
    home_care_donts: z.array(z.string()).optional(),
    is_emergency: z.boolean().optional(),
  })
  .optional()
export type PatientCareSummary = z.infer<typeof PatientCareSummarySchema>

export const PredictResponseSchema = z.object({
  analysis_id: z.string().optional(),
  created_at: z.string().optional(),
  probs: z.record(z.string(), z.number()),
  top3: z.array(z.tuple([z.string(), z.number()])),
  differential_strategy: DifferentialStrategySchema,
  malignant_flag: z.boolean(),
  malignant_prob: z.number(),
  risk: RiskSchema,
  metrics: MetricsSchema,
  images: ImagesSchema,
  hair_removal: HairRemovalDiagnosticsSchema,
  quality: QualityReportSchema,
  verification: VerificationResultSchema,
  evidence: z.array(RAGPassageSchema).optional(),
  cam_target_class: z.string().optional(),
  cam_valid: z.boolean().optional(),
  seg_valid: z.boolean().optional(),
  xai: XaiDiagnosticsSchema,
  persistence: PersistenceInfoSchema,
  council: z.record(z.string(), z.any()).optional(),
  patient_summary: PatientCareSummarySchema,
})
export type PredictResponse = z.infer<typeof PredictResponseSchema>

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string().optional(),
  version: z.string().optional(),
})
export type HealthResponse = z.infer<typeof HealthResponseSchema>

export const ReadyResponseSchema = z.object({
  ready: z.boolean(),
  model: z.string().optional(),
  weights: z.string().optional(),
})
export type ReadyResponse = z.infer<typeof ReadyResponseSchema>

export type ApiErrorCode = 400 | 404 | 413 | 500 | 502 | 503 | 504 | 'NETWORK_ERROR' | 'TIMEOUT' | 'PARSE_ERROR'

export interface ApiError {
  code: ApiErrorCode
  message: string
  detail?: string
  canRetry: boolean
}
