import { LESION_LABELS, type PredictResponse } from './types'
import type { BookingConfirmation } from './booking'

/** Minimal, zero-dependency multi-page PDF 1.4 generator for direct real file downloads. */

const PAGE_W = 595.28 // A4 width in pt
const PAGE_H = 841.89 // A4 height in pt
const MARGIN_X = 44
const CONTENT_W = PAGE_W - MARGIN_X * 2

function sanitizePdfText(input: string): string {
  // Normalize non-WinAnsi Unicode characters cleanly so Helvetica built-in font renders properly
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '*')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u00b2/g, '^2')
    .replace(/\u0394/g, 'Delta')
    .replace(/\u03c4/g, 'tau')
    .replace(/\u03c0/g, 'pi')
    .replace(/[^\x20-\x7E\n]/g, ' ')
}

function pdfEscape(text: string): string {
  return sanitizePdfText(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function wrapText(text: string, maxChars: number): string[] {
  const clean = sanitizePdfText(text).trim()
  if (!clean) return []
  const paragraphs = clean.split(/\n+/)
  const out: string[] = []
  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/)
    let line = ''
    for (const word of words) {
      if (!word) continue
      const candidate = line ? `${line} ${word}` : word
      if (candidate.length > maxChars && line) {
        out.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    if (line) out.push(line)
  }
  return out
}

interface PdfRgb {
  r: number
  g: number
  b: number
}

const COLORS: Record<string, PdfRgb> = {
  navy: { r: 0.06, g: 0.09, b: 0.17 },
  blue: { r: 0.11, g: 0.31, b: 0.85 },
  emerald: { r: 0.02, g: 0.47, b: 0.34 },
  amber: { r: 0.71, g: 0.33, b: 0.04 },
  slateDark: { r: 0.12, g: 0.16, b: 0.23 },
  slateMuted: { r: 0.39, g: 0.45, b: 0.55 },
  cardBg: { r: 0.97, g: 0.98, b: 0.99 },
  cardBorder: { r: 0.85, g: 0.89, b: 0.94 },
  white: { r: 1, g: 1, b: 1 },
}

class PdfDocBuilder {
  private pages: string[] = []
  private ops: string[] = []
  private y = PAGE_H - 44

  constructor(private docTitle: string, private docSubtitle: string, private headerAccent: PdfRgb = COLORS.blue) {
    this.startPage(true)
  }

  private setFill(c: PdfRgb) {
    this.ops.push(`${c.r.toFixed(3)} ${c.g.toFixed(3)} ${c.b.toFixed(3)} rg`)
  }

  private setStroke(c: PdfRgb) {
    this.ops.push(`${c.r.toFixed(3)} ${c.g.toFixed(3)} ${c.b.toFixed(3)} RG`)
  }

  private drawText(x: number, y: number, text: string, size = 10, bold = false, color: PdfRgb = COLORS.slateDark) {
    this.setFill(color)
    const font = bold ? '/F2' : '/F1'
    this.ops.push(`BT ${font} ${size.toFixed(1)} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${pdfEscape(text)}) Tj ET`)
  }

  private startPage(isFirst: boolean) {
    this.ops = []
    if (isFirst) {
      // Clinical header banner
      this.setFill(COLORS.navy)
      this.ops.push(`0 ${(PAGE_H - 86).toFixed(2)} ${PAGE_W.toFixed(2)} 86.00 re f`)
      this.setFill(this.headerAccent)
      this.ops.push(`0 ${(PAGE_H - 90).toFixed(2)} ${PAGE_W.toFixed(2)} 4.00 re f`)

      this.drawText(MARGIN_X, PAGE_H - 36, this.docTitle, 16, true, COLORS.white)
      this.drawText(MARGIN_X, PAGE_H - 56, this.docSubtitle, 9.5, false, { r: 0.79, g: 0.85, b: 0.94 })
      this.drawText(PAGE_W - MARGIN_X - 150, PAGE_H - 36, 'OptiDerma Clinical AI', 10, true, { r: 0.48, g: 0.75, b: 0.98 })
      this.drawText(PAGE_W - MARGIN_X - 150, PAGE_H - 52, new Date().toISOString().slice(0, 10), 8.5, false, { r: 0.75, g: 0.82, b: 0.90 })
      this.y = PAGE_H - 114
    } else {
      this.drawText(MARGIN_X, PAGE_H - 34, `${this.docTitle} (continued)`, 9, true, COLORS.slateMuted)
      this.setStroke(COLORS.cardBorder)
      this.ops.push(`0.6 w ${MARGIN_X.toFixed(2)} ${(PAGE_H - 42).toFixed(2)} m ${(PAGE_W - MARGIN_X).toFixed(2)} ${(PAGE_H - 42).toFixed(2)} l S`)
      this.y = PAGE_H - 64
    }
  }

  private ensureSpace(neededPt: number) {
    if (this.y - neededPt < 64) {
      this.pages.push(this.ops.join('\n'))
      this.startPage(false)
    }
  }

  addSectionHeading(title: string) {
    this.ensureSpace(34)
    this.y -= 6
    this.drawText(MARGIN_X, this.y, title.toUpperCase(), 10.5, true, COLORS.blue)
    this.y -= 6
    this.setStroke(COLORS.cardBorder)
    this.ops.push(`0.8 w ${MARGIN_X.toFixed(2)} ${this.y.toFixed(2)} m ${(PAGE_W - MARGIN_X).toFixed(2)} ${this.y.toFixed(2)} l S`)
    this.y -= 14
  }

  addKeyValueCard(rows: Array<[string, string]>) {
    const lineHeight = 15
    const boxHeight = rows.length * lineHeight + 16
    this.ensureSpace(boxHeight + 10)
    const boxBottom = this.y - boxHeight + 8

    this.setFill(COLORS.cardBg)
    this.setStroke(COLORS.cardBorder)
    this.ops.push(`0.8 w ${MARGIN_X.toFixed(2)} ${boxBottom.toFixed(2)} ${CONTENT_W.toFixed(2)} ${boxHeight.toFixed(2)} re B`)

    let curY = this.y - 6
    for (const [label, value] of rows) {
      const clippedVal = sanitizePdfText(value).slice(0, 68)
      this.drawText(MARGIN_X + 12, curY, `${label}:`, 9.5, true, COLORS.slateMuted)
      this.drawText(MARGIN_X + 165, curY, clippedVal, 9.5, false, COLORS.slateDark)
      curY -= lineHeight
    }
    this.y = boxBottom - 12
  }

  addParagraph(text: string, fontSize = 9.8, bold = false, color: PdfRgb = COLORS.slateDark) {
    const lines = wrapText(text, Math.floor((CONTENT_W / (fontSize * 0.52))))
    for (const line of lines) {
      this.ensureSpace(15)
      this.drawText(MARGIN_X, this.y, line, fontSize, bold, color)
      this.y -= 13.5
    }
    this.y -= 4
  }

  addBullets(items: string[], fontSize = 9.5) {
    for (const item of items) {
      const lines = wrapText(item, 86)
      lines.forEach((line, idx) => {
        this.ensureSpace(14)
        if (idx === 0) {
          this.drawText(MARGIN_X + 6, this.y, '-', fontSize, true, COLORS.blue)
        }
        this.drawText(MARGIN_X + 18, this.y, line, fontSize, false, COLORS.slateDark)
        this.y -= 13
      })
    }
    this.y -= 4
  }

  addDisclaimerFooter(note: string) {
    this.ensureSpace(46)
    this.y -= 4
    const lines = wrapText(note, 98)
    const h = lines.length * 11.5 + 14
    const bottom = this.y - h + 6
    this.setFill({ r: 0.99, g: 0.96, b: 0.90 })
    this.setStroke({ r: 0.93, g: 0.78, b: 0.48 })
    this.ops.push(`0.8 w ${MARGIN_X.toFixed(2)} ${bottom.toFixed(2)} ${CONTENT_W.toFixed(2)} ${h.toFixed(2)} re B`)
    let curY = this.y - 6
    for (const line of lines) {
      this.drawText(MARGIN_X + 10, curY, line, 8.2, false, COLORS.amber)
      curY -= 11.5
    }
    this.y = bottom - 10
  }

  buildBlob(): Blob {
    this.pages.push(this.ops.join('\n'))

    const objects: string[] = []
    const addObj = (body: string) => {
      objects.push(body)
      return objects.length
    }

    const catalogId = addObj('') // 1
    const pagesId = addObj('') // 2
    const fontRegularId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>') // 3
    const fontBoldId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>') // 4

    const pageIds: number[] = []
    this.pages.forEach((streamContent, idx) => {
      const footer = `0.39 0.45 0.55 rg BT /F1 8.0 Tf ${MARGIN_X} 28.0 Td (OptiDerma Clinical Decision Support - Page ${idx + 1} of ${this.pages.length}) Tj ET`
      const fullStream = `${streamContent}\n${footer}`
      const contentId = addObj(`<< /Length ${fullStream.length} >>\nstream\n${fullStream}\nendstream`)
      const pageId = addObj(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
      )
      pageIds.push(pageId)
    })

    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`

    let pdf = '%PDF-1.4\n'
    const offsets: number[] = [0]
    objects.forEach((objBody, i) => {
      offsets.push(pdf.length)
      pdf += `${i + 1} 0 obj\n${objBody}\nendobj\n`
    })

    const xrefStart = pdf.length
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    for (let i = 1; i <= objects.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

    return new Blob([pdf], { type: 'application/pdf' })
  }
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function buildClinicalAnalysisPdf(result: PredictResponse): Blob {
  const topCode = result.top3?.[0]?.[0] || 'nv'
  const topProb = ((result.top3?.[0]?.[1] ?? 0) * 100).toFixed(1)
  const label = LESION_LABELS[topCode]?.title || topCode.toUpperCase()
  const doc = new PdfDocBuilder(
    'OptiDerma Clinical Analysis Report',
    `Analysis ID: ${result.analysis_id || 'Local Session'} | Primary Match: ${label}`,
    result.malignant_flag ? { r: 0.78, g: 0.16, b: 0.22 } : COLORS.blue
  )

  doc.addSectionHeading('1. Executive Diagnostic Summary')
  doc.addKeyValueCard([
    ['Analysis Reference', result.analysis_id || 'Session Scan'],
    ['Primary Attribution', `${label} (${topCode.toUpperCase()})`],
    ['Uncalibrated Score', `${topProb}% (Multi-class Softmax T=1.0)`],
    ['Malignancy Pool Sum', `${(result.malignant_prob * 100).toFixed(1)}% (Mel + BCC + AKIEC)`],
    ['Triage Category', `${result.risk.level} Risk`],
    ['Verification Status', result.verification?.passed ? 'PASSED (Mathematical invariants valid)' : 'Clinical review advised'],
  ])
  doc.addParagraph(result.risk.recommendation)

  if (result.top3?.length) {
    doc.addSectionHeading('2. Top Differential Probabilities')
    doc.addBullets(
      result.top3.map(([code, prob], idx) => {
        const title = LESION_LABELS[code]?.title || code.toUpperCase()
        return `#${idx + 1} ${title} (${code.toUpperCase()}): ${(prob * 100).toFixed(1)}% uncalibrated softmax activation`
      })
    )
  }

  doc.addSectionHeading('3. U-Net Morphometrics & DullRazor Cleaning')
  doc.addKeyValueCard([
    ['Segmented Area', `${result.metrics.area_px ?? Math.round(result.metrics.area_mm2 * 900)} px (~${result.metrics.area_mm2.toFixed(1)} mm^2 uncalibrated)`],
    ['Contour Perimeter', `${Math.round(result.metrics.perimeter_px ?? result.metrics.perimeter_mm * 30)} px (~${result.metrics.perimeter_mm.toFixed(1)} mm uncalibrated)`],
    ['Asymmetry Index', `${result.metrics.asymmetry_index.toFixed(2)} (0 = symmetric, 1 = asymmetric)`],
    ['Compactness (P^2/4piA)', `${result.metrics.compactness.toFixed(2)} (1.00 = circular, > 1.30 irregular)`],
    ['DullRazor Artifacts', result.hair_removal?.hair_detected ? `${result.hair_removal.detected_strands || 0} strands removed` : 'No occluding hair artifacts detected'],
    ['Grad-CAM Energy', `${result.xai?.energy_inside_pct ?? 'N/A'}% localized within lesion mask`],
  ])

  if (result.patient_summary) {
    doc.addSectionHeading('4. Patient-Friendly Guidance & Next Steps')
    doc.addParagraph(result.patient_summary.headline, 10.5, true, COLORS.emerald)
    doc.addParagraph(result.patient_summary.simple_explanation)
    if (result.patient_summary.action_plan?.length) {
      doc.addBullets(result.patient_summary.action_plan)
    }
  }

  doc.addDisclaimerFooter(
    'IMPORTANT CLINICAL NOTICE: OptiDerma is an investigational AI decision-support tool, not a medical diagnosis. Physical mm measurements are uncalibrated unless optical scale markers were present. Always consult a board-certified dermatologist.'
  )
  return doc.buildBlob()
}

export function downloadPatientHandoutPdf(result: PredictResponse): void {
  const topCode = result.top3?.[0]?.[0] || 'nv'
  const topProb = ((result.top3?.[0]?.[1] ?? 0) * 100).toFixed(1)
  const label = result.patient_summary?.condition_plain_name || LESION_LABELS[topCode]?.title || topCode.toUpperCase()
  const doc = new PdfDocBuilder(
    'OptiDerma Patient Care Handout',
    `Prepared for your dermatologist consultation | Ref: ${result.analysis_id?.slice(0, 12) || 'Active Spot'}`,
    COLORS.emerald
  )

  doc.addSectionHeading('Your AI Skin Spot Summary')
  doc.addKeyValueCard([
    ['Pattern Matched', label],
    ['Similarity Score', `${topProb}%`],
    ['Concern Level', result.patient_summary?.concern_level || result.risk.level],
    ['Asymmetry', result.patient_summary?.what_ai_noticed?.symmetry || result.metrics.asymmetry_index.toFixed(2)],
    ['Border Contour', result.patient_summary?.what_ai_noticed?.border || result.metrics.compactness.toFixed(2)],
    ['Estimated Size', result.patient_summary?.what_ai_noticed?.size || `~${result.metrics.area_mm2.toFixed(1)} mm^2`],
  ])

  if (result.patient_summary?.simple_explanation) {
    doc.addSectionHeading('What This Means in Everyday Words')
    doc.addParagraph(result.patient_summary.simple_explanation)
  }

  if (result.patient_summary?.action_plan?.length) {
    doc.addSectionHeading('Recommended Next Steps')
    doc.addBullets(result.patient_summary.action_plan)
  }

  if (result.patient_summary?.doctor_questions?.length) {
    doc.addSectionHeading('Questions to Ask Your Dermatologist')
    doc.addBullets(result.patient_summary.doctor_questions)
  }

  if (result.patient_summary?.home_care_dos?.length) {
    doc.addSectionHeading('Home Care Dos & Don\'ts')
    doc.addBullets([
      ...result.patient_summary.home_care_dos.map((d) => `DO: ${d}`),
      ...(result.patient_summary.home_care_donts || []).map((d) => `AVOID: ${d}`),
    ])
  }

  doc.addDisclaimerFooter(
    'This patient handout is generated by OptiDerma for educational doctor-visit preparation. Only an in-person clinical exam by a dermatologist can establish a medical diagnosis.'
  )

  const idSlug = result.analysis_id ? result.analysis_id.slice(0, 8) : 'patient'
  triggerBlobDownload(doc.buildBlob(), `optiderma_patient_handout_${idSlug}.pdf`)
}

export async function downloadAnalysisPdf(
  pdfEndpointUrl: string,
  analysisId: string,
  fallbackResult?: PredictResponse | null
): Promise<'server' | 'client'> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    const response = await fetch(pdfEndpointUrl, {
      method: 'GET',
      headers: { Accept: 'application/pdf' },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (response.ok) {
      const contentType = response.headers.get('content-type') || ''
      const blob = await response.blob()
      if (blob.size > 200 && (contentType.includes('pdf') || blob.type.includes('pdf'))) {
        triggerBlobDownload(blob, `optiderma_clinical_report_${analysisId.slice(0, 8)}.pdf`)
        return 'server'
      }
    }
  } catch {
    // Fall through cleanly if network is momentarily unavailable and we have in-memory analysis data
  }

  if (fallbackResult) {
    const clientBlob = buildClinicalAnalysisPdf(fallbackResult)
    triggerBlobDownload(clientBlob, `optiderma_clinical_report_${analysisId.slice(0, 8)}.pdf`)
    return 'client'
  }

  throw new Error('Could not download the PDF report from the server.')
}

export interface AppointmentSlipDetails {
  confirmationId: string
  status: string
  patientName: string
  patientEmail: string
  patientPhone?: string
  clinicName: string
  clinicAddress?: string
  clinicPhone?: string
  preferredDate: string
  consultationType: string
  reason?: string
  analysisSummary?: string
}

export function downloadAppointmentSlipPdf(details: AppointmentSlipDetails): void {
  const doc = new PdfDocBuilder(
    'OptiDerma Appointment Request Slip',
    `Reference ID: ${details.confirmationId} | Status: ${details.status.toUpperCase()}`,
    COLORS.emerald
  )

  doc.addSectionHeading('Patient & Clinic Details')
  doc.addKeyValueCard([
    ['Reference ID', details.confirmationId],
    ['Request Status', details.status],
    ['Patient Name', details.patientName || 'Provided at clinic'],
    ['Contact Email', details.patientEmail || 'Not provided'],
    ...(details.patientPhone ? [['Contact Phone', details.patientPhone] as [string, string]] : []),
    ['Preferred Date', details.preferredDate || 'Upcoming available slot'],
    ['Consultation Mode', details.consultationType.replace('_', ' ')],
    ['Target Clinic', details.clinicName || 'Accredited Dermatology Department'],
    ...(details.clinicAddress ? [['Clinic Address', details.clinicAddress] as [string, string]] : []),
    ...(details.clinicPhone ? [['Clinic Helpline', details.clinicPhone] as [string, string]] : []),
  ])

  if (details.reason) {
    doc.addSectionHeading('Reported Symptoms / Reason for Visit')
    doc.addParagraph(details.reason)
  }

  if (details.analysisSummary) {
    doc.addSectionHeading('Attached OptiDerma Lesion Finding')
    doc.addParagraph(details.analysisSummary)
  }

  doc.addSectionHeading('Dermatologist Visit Preparation Checklist')
  doc.addBullets([
    'Clean Skin: Avoid wearing makeup, foundation, concealer, or thick lotion on the area being examined.',
    'Timeline Photos: Bring any older smartphone photos of the spot to help assess ABCDE evolution.',
    'Symptom Notes: Note exact duration, any itching, crusting, oozing, or bleeding episodes.',
  ])

  doc.addDisclaimerFooter(
    'APPOINTMENT COORDINATION NOTICE: Please confirm final slot availability directly with the hospital desk or teleconsultation portal before traveling.'
  )

  triggerBlobDownload(doc.buildBlob(), `optiderma_appointment_${details.confirmationId.slice(0, 10)}.pdf`)
}

export function downloadBookingConfirmationPdf(booking: BookingConfirmation): void {
  downloadAppointmentSlipPdf({
    confirmationId: booking.reference,
    status: 'Confirmed Slot Request',
    patientName: booking.name,
    patientEmail: booking.email,
    clinicName: 'OptiDerma Tele-Dermatology Desk',
    preferredDate: `${booking.slot.label} (${booking.timezone})`,
    consultationType: 'Tele-Consultation',
  })
}

export function downloadConsultationPacketPdf(markdownText: string, analysisId?: string | null): void {
  const doc = new PdfDocBuilder(
    'OptiDerma Doctor Consultation Packet',
    `Analysis Reference: ${analysisId || 'General Skin Consultation Prep'}`,
    COLORS.blue
  )

  const lines = markdownText.split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('# ')) {
      doc.addSectionHeading(line.replace(/^#+\s*/, ''))
    } else if (line.startsWith('##') || line.startsWith('###')) {
      doc.addSectionHeading(line.replace(/^#+\s*/, ''))
    } else if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      doc.addBullets([line.replace(/^([-*]|\d+\.)\s+/, '').replace(/\*\*/g, '')])
    } else {
      doc.addParagraph(line.replace(/\*\*/g, ''))
    }
  }

  doc.addDisclaimerFooter(
    'Prepared with OptiDerma Clinical Decision Support. Share this packet with your dermatologist during consultation.'
  )

  const slug = analysisId ? analysisId.slice(0, 8) : 'visit'
  triggerBlobDownload(doc.buildBlob(), `optiderma_consultation_packet_${slug}.pdf`)
}

export interface ComparisonScanSummary {
  analysis_id: string
  top_condition: string
  top_score: number
  malignant_prob: number
  risk_level: string
  recommendation: string
  created_at: string
}

export function downloadEvolutionComparisonPdf(scanA: ComparisonScanSummary, scanB: ComparisonScanSummary): void {
  const doc = new PdfDocBuilder(
    'OptiDerma Longitudinal Spot Evolution Report',
    `Comparing Baseline (${scanA.analysis_id.slice(0, 8)}) vs Follow-Up (${scanB.analysis_id.slice(0, 8)})`,
    COLORS.blue
  )

  const labelA = LESION_LABELS[scanA.top_condition]?.title || scanA.top_condition.toUpperCase()
  const labelB = LESION_LABELS[scanB.top_condition]?.title || scanB.top_condition.toUpperCase()

  doc.addSectionHeading('Scan A - Baseline Record')
  doc.addKeyValueCard([
    ['Analysis ID', scanA.analysis_id],
    ['Recorded Date', new Date(scanA.created_at).toLocaleString()],
    ['Primary Attribution', `${labelA} (${Math.round(scanA.top_score * 100)}%)`],
    ['Risk Category', scanA.risk_level],
    ['Recommendation', scanA.recommendation],
  ])

  doc.addSectionHeading('Scan B - Follow-Up Record')
  doc.addKeyValueCard([
    ['Analysis ID', scanB.analysis_id],
    ['Recorded Date', new Date(scanB.created_at).toLocaleString()],
    ['Primary Attribution', `${labelB} (${Math.round(scanB.top_score * 100)}%)`],
    ['Risk Category', scanB.risk_level],
    ['Recommendation', scanB.recommendation],
  ])

  doc.addSectionHeading('Longitudinal Stability Summary')
  const sameClass = scanA.top_condition === scanB.top_condition
  const sameRisk = scanA.risk_level === scanB.risk_level
  doc.addParagraph(
    sameClass
      ? `Primary pattern remained consistent (${labelA}) between both scans.`
      : `Primary pattern shifted from ${labelA} to ${labelB} between scans. Direct dermoscopic evaluation is advised.`,
    10,
    true
  )
  doc.addParagraph(
    sameRisk
      ? `Assessed risk triage category remained stable at ${scanA.risk_level}.`
      : `Risk triage shifted from ${scanA.risk_level} to ${scanB.risk_level}. In-person dermatologist comparison is recommended to evaluate interval evolution (ABCDE 'E' criterion).`
  )

  doc.addDisclaimerFooter(
    'LONGITUDINAL NOTE: Automated comparisons depend on lighting, angle, and zoom consistency across photos. Bring both original images to your dermatologist.'
  )

  triggerBlobDownload(doc.buildBlob(), `optiderma_evolution_${scanA.analysis_id.slice(0, 6)}_vs_${scanB.analysis_id.slice(0, 6)}.pdf`)
}
