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
  area_mm2: z.number(),
  perimeter_mm: z.number(),
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
  })
  .optional()
export type LesionImages = z.infer<typeof ImagesSchema>

export const PredictResponseSchema = z.object({
  probs: z.record(z.string(), z.number()),
  top3: z.array(z.tuple([z.string(), z.number()])),
  malignant_flag: z.boolean(),
  malignant_prob: z.number(),
  risk: RiskSchema,
  metrics: MetricsSchema,
  images: ImagesSchema,
})
export type PredictResponse = z.infer<typeof PredictResponseSchema>

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
})
export type HealthResponse = z.infer<typeof HealthResponseSchema>

export type ApiErrorCode = 400 | 413 | 500 | 502 | 503 | 504 | 'NETWORK_ERROR' | 'TIMEOUT' | 'PARSE_ERROR'

export interface ApiError {
  code: ApiErrorCode
  message: string
  detail?: string
  canRetry: boolean
}
