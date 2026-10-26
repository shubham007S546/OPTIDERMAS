'use client'

import React, { useState, useEffect } from 'react'
import {
  FileText,
  Download,
  Printer,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Info,
} from 'lucide-react'
import { getReportPdfUrl, fetchRecentAnalyses, type RecentAnalysisSummary } from '@/lib/api'
import type { PredictResponse } from '@/lib/types'

const PATIENT_GUIDANCE: Record<
  string,
  {
    commonName: string
    whatItIs: string
    recommendation: string
    warningSigns: string[]
    questionsForDoctor: string[]
  }
> = {
  akiec: {
    commonName: 'Actinic Keratosis / Pre-cancerous Sun Spot',
    whatItIs:
      'A common scaly, rough, or crusty skin spot caused by cumulative sun exposure. While not an invasive cancer, it is considered pre-cancerous because a small percentage can evolve into squamous cell carcinoma if left untreated.',
    recommendation:
      'Schedule a routine in-person visit with a dermatologist. Common treatments are quick and outpatient, such as gentle liquid nitrogen cryotherapy or topical prescription creams.',
    warningSigns: [
      'Rapid enlargement or pronounced thickening/hardening',
      'Bleeding, oozing, or ulceration that does not heal',
      'Spontaneous tenderness, throbbing, or soreness',
    ],
    questionsForDoctor: [
      'Is cryotherapy (freezing) or a topical cream recommended for this spot?',
      'Do you observe other sun-damaged spots on my surrounding skin?',
      'How frequently should I schedule routine full-body skin checks?',
    ],
  },
  mel: {
    commonName: 'Potential Cutaneous Melanoma / High-Concern Pigmented Lesion',
    whatItIs:
      'A high-concern pigment lesion requiring prompt in-person dermatological assessment. Melanoma arises from pigment-producing cells (melanocytes) and has the potential to spread if not removed early.',
    recommendation:
      'Please schedule an urgent in-person evaluation with a dermatologist or skin cancer center for physical dermoscopy and biopsy if indicated. Do not attempt home remedies or wait for symptoms to worsen.',
    warningSigns: [
      'Asymmetry, uneven or jagged borders',
      'Multiple colors (brown, black, red, white, or blue)',
      'Diameter greater than 6mm or noticeable evolution/growth',
    ],
    questionsForDoctor: [
      'Is an immediate excisional biopsy indicated for this lesion?',
      'What dermoscopic features of concern do you observe?',
      'When can I expect the pathology results?',
    ],
  },
  bcc: {
    commonName: 'Basal Cell Carcinoma (Common Skin Cancer)',
    whatItIs:
      'The most frequent form of skin cancer. It grows slowly, almost never spreads to internal organs, but can cause local tissue damage if left untreated over months or years.',
    recommendation:
      'Arrange a formal clinical consultation. Dermatologists treat BCC with very high cure rates using minor outpatient procedures like excision, Mohs micrographic surgery, or topical therapy.',
    warningSigns: [
      'Pearly or translucent bump with visible tiny blood vessels',
      'A sore that bleeds, scabs, and reopens without resolving',
      'Firm, scar-like white or yellow area without prior injury',
    ],
    questionsForDoctor: [
      'Which treatment approach (standard excision, Mohs surgery, or topical) is best for this location?',
      'Will there be a noticeable scar, and how will it heal?',
    ],
  },
  bkl: {
    commonName: 'Benign Keratosis (Seborrheic Keratosis / Age Spot)',
    whatItIs:
      'A completely benign, non-cancerous skin growth that is very common as people age. They often appear "stuck on" the skin with a waxy, granular, or rough texture.',
    recommendation:
      'No treatment is medically necessary unless the spot becomes irritated, itchy, or catches on clothing. A doctor can easily confirm its benign nature under dermoscopy.',
    warningSigns: [
      'Sudden rapid growth or dark irregular color changes',
      'Bleeding without irritation or rubbing',
    ],
    questionsForDoctor: [
      'Can you confirm this is benign under dermoscopy?',
      'If it catches on my clothes, what is the simplest way to remove it?',
    ],
  },
  nv: {
    commonName: 'Melanocytic Nevus (Common Mole)',
    whatItIs:
      'A typical, benign collection of pigment cells. Normal moles are symmetric, uniformly colored, and remain stable over long periods.',
    recommendation:
      'Routine self-monitoring. Protect your skin with broad-spectrum SPF 30+ sunscreen and report any ABCDE changes to a doctor.',
    warningSigns: [
      'Noticeable change in size, shape, or shade',
      'Spontaneous itching or bleeding',
    ],
    questionsForDoctor: [
      'Does this mole show regular symmetric dermoscopy patterns?',
      'Should we photograph it to track changes over time?',
    ],
  },
  df: {
    commonName: 'Dermatofibroma (Harmless Fibrous Nodule)',
    whatItIs:
      'A benign, firm, small bump that often develops on the lower legs or arms, sometimes after minor insect bites or minor skin injuries.',
    recommendation:
      'Harmless and requires no intervention. It often dimples downward when gently pinched between two fingers (positive "dimple sign").',
    warningSigns: [
      'Rapid enlargement or ulceration',
    ],
    questionsForDoctor: [
      'Can you confirm the dimple sign to ensure it is a dermatofibroma?',
    ],
  },
  vasc: {
    commonName: 'Vascular Lesion (Cherry Angioma or Blood Vessel Cluster)',
    whatItIs:
      'A harmless collection of small blood vessels near the skin surface, appearing as a bright red, purple, or dark vascular mark.',
    recommendation:
      'Completely benign. No treatment is needed unless desired for cosmetic reasons or if it repeatedly bleeds after being scraped.',
    warningSigns: [
      'Persistent bleeding or rapid darkening',
    ],
    questionsForDoctor: [
      'Can you confirm this is a vascular angioma?',
    ],
  },
}

interface ReportsWorkspaceViewProps {
  currentResult?: PredictResponse | null
  onSelectAnalysis: (analysisId: string) => void
  onNavigateAnalyze: () => void
}

export function ReportsWorkspaceView({
  currentResult,
  onSelectAnalysis,
  onNavigateAnalyze,
}: ReportsWorkspaceViewProps) {
  const [reportType, setReportType] = useState<'technical' | 'patient'>('patient')
  const [recentList, setRecentList] = useState<RecentAnalysisSummary[]>([])
  const [loadingRecent, setLoadingRecent] = useState(false)

  useEffect(() => {
    async function load() {
      setLoadingRecent(true)
      try {
        const data = await fetchRecentAnalyses(10)
        setRecentList(data)
      } catch {
        setRecentList([])
      } finally {
        setLoadingRecent(false)
      }
    }
    load()
  }, [])

  const analysisId = currentResult?.analysis_id

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-sky-600" />
            <h2 className="text-xl font-bold text-slate-900">Clinical Reports & PDF Documentation</h2>
          </div>
          <p className="text-xs text-slate-600">
            Export publication-grade PDF consultation reports incorporating 7-class differential, Grad-CAM overlays, and deterministic verification audits.
          </p>
        </div>

        {analysisId && (
          <div className="flex items-center gap-2 self-start sm:self-center">
            <a
              href={getReportPdfUrl(analysisId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-2xs transition-all"
            >
              <Download size={14} />
              <span>Download Official PDF</span>
            </a>
            <button
              onClick={() => window.print()}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs transition-colors"
              title="Print Report"
            >
              <Printer size={15} />
            </button>
          </div>
        )}
      </div>

      {currentResult ? (
        <div className="space-y-4">
          {/* Report Type Selector */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl w-fit">
            <button
              onClick={() => setReportType('technical')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                reportType === 'technical'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Technical Research Audit
            </button>
            <button
              onClick={() => setReportType('patient')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                reportType === 'patient'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Patient-Friendly Summary
            </button>
          </div>

          {/* Structured Report Preview */}
          <div className="p-6 sm:p-8 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-6">
            {/* Header */}
            <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 block">
                  {reportType === 'technical'
                    ? 'OptiDerma Automated Clinical Research Audit'
                    : 'OptiDerma Patient-Friendly Care Summary'}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Case Record: {currentResult.analysis_id}
                </h3>
              </div>
              <div className="text-right text-xs text-slate-500 font-mono">
                Generated: {new Date().toLocaleDateString()}
              </div>
            </div>

            {reportType === 'technical' ? (
              /* ================== TECHNICAL RESEARCH AUDIT VIEW ================== */
              <div className="space-y-6">
                {/* Differential Findings Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Primary Finding</span>
                    <p className="text-base font-extrabold text-slate-900 mt-1">
                      {currentResult.top3?.[0]?.[0]?.toUpperCase()}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Confidence: {Math.round((currentResult.top3?.[0]?.[1] || 0) * 100)}%
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Triage Category</span>
                    <p className="text-base font-extrabold text-slate-900 mt-1">
                      {currentResult.risk?.level}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {currentResult.risk?.recommendation}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Verification Audit</span>
                    <p className="text-base font-extrabold text-emerald-600 mt-1">
                      {currentResult.verification?.passed ? 'PASSED (0 Warnings)' : 'Clinical Review Needed'}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Deterministic check suite
                    </p>
                  </div>
                </div>

                {/* Detailed Differential Logits */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Full 7-Class Differential Probability Spectrum
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {currentResult.top3?.map(([code, score]) => (
                      <div key={code} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between">
                        <span className="font-semibold text-slate-700">{code.toUpperCase()}</span>
                        <span className="font-mono font-bold text-slate-900">{Math.round(score * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Verification Checklist */}
                {currentResult.verification?.checks_summary && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Verification Audit Subsystem Results
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                      {Object.entries(currentResult.verification.checks_summary).map(([k, v]) => (
                        <div key={k} className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                          <span className="text-slate-600">{k}:</span>
                          <span className={v ? 'text-emerald-600 font-bold' : 'text-amber-600'}>
                            {v ? 'PASS' : 'WARN'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ================== PATIENT-FRIENDLY SUMMARY VIEW ================== */
              <div className="space-y-6">
                {(() => {
                  const patientSummary = currentResult.patient_summary
                  const topCode = currentResult.top3?.[0]?.[0]?.toLowerCase() || 'akiec'
                  const fallbackGuidance = PATIENT_GUIDANCE[topCode] || {
                    commonName: topCode.toUpperCase(),
                    whatItIs: 'A skin lesion requiring standard dermatological evaluation.',
                    recommendation: 'Consult a dermatologist for clinical examination.',
                    warningSigns: ['Rapid growth', 'Bleeding or oozing', 'Changing color'],
                    questionsForDoctor: ['What are the recommended next steps for this spot?'],
                  }
                  const commonName = patientSummary?.condition_plain_name || fallbackGuidance.commonName
                  const headline = patientSummary?.headline || 'AI Evaluation Summary'
                  const whatItIs = patientSummary?.simple_explanation || fallbackGuidance.whatItIs
                  const concernLevel = patientSummary?.concern_level || currentResult.risk?.level || 'Moderate'
                  const actionSteps = patientSummary?.action_plan?.length
                    ? patientSummary.action_plan
                    : [fallbackGuidance.recommendation]
                  const doctorQuestions = patientSummary?.doctor_questions?.length
                    ? patientSummary.doctor_questions
                    : fallbackGuidance.questionsForDoctor
                  const whatAiNoticed = patientSummary?.what_ai_noticed
                  const confPct = Math.round((currentResult.top3?.[0]?.[1] || 0) * 100)

                  return (
                    <div className="space-y-5">
                      {/* Patient-Friendly Diagnosis Header */}
                      <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                            What the AI analysis found:
                          </span>
                          <h4 className="text-lg font-extrabold text-emerald-950">
                            {commonName}
                          </h4>
                          <p className="text-xs text-slate-700">
                            Algorithmic match confidence: <strong>{confPct}%</strong> • Triage: <strong className="text-slate-900">{concernLevel}</strong>
                          </p>
                          <p className="text-xs text-emerald-900 font-medium pt-0.5">
                            {headline}
                          </p>
                        </div>
                        <div className="px-3.5 py-1.5 rounded-xl bg-white border border-emerald-300 text-xs text-emerald-900 font-bold self-start sm:self-center shrink-0 shadow-2xs">
                          {concernLevel}
                        </div>
                      </div>

                      {/* What is this lesion in plain language? */}
                      <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <Sparkles size={14} className="text-emerald-600" />
                          <span>What Does This Mean In Plain Language?</span>
                        </h4>
                        <p className="text-sm text-slate-700 leading-relaxed">
                          {whatItIs}
                        </p>
                      </div>

                      {/* What the AI noticed visually */}
                      {whatAiNoticed && (
                        <div className="p-5 rounded-2xl bg-sky-50/60 border border-sky-200 space-y-3">
                          <h4 className="text-xs font-bold text-sky-900 uppercase tracking-wider flex items-center gap-2">
                            <Info size={14} className="text-sky-700" />
                            <span>Visual Signs Noticed In Your Photo</span>
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                            {whatAiNoticed.shape && (
                              <div className="p-2.5 rounded-xl bg-white/80 border border-sky-100">
                                <span className="font-bold text-sky-950 block">Shape & Symmetry:</span>
                                <span>{whatAiNoticed.shape}</span>
                              </div>
                            )}
                            {whatAiNoticed.border && (
                              <div className="p-2.5 rounded-xl bg-white/80 border border-sky-100">
                                <span className="font-bold text-sky-950 block">Borders & Edges:</span>
                                <span>{whatAiNoticed.border}</span>
                              </div>
                            )}
                            {whatAiNoticed.color && (
                              <div className="p-2.5 rounded-xl bg-white/80 border border-sky-100">
                                <span className="font-bold text-sky-950 block">Color & Texture:</span>
                                <span>{whatAiNoticed.color}</span>
                              </div>
                            )}
                            {whatAiNoticed.size && (
                              <div className="p-2.5 rounded-xl bg-white/80 border border-sky-100">
                                <span className="font-bold text-sky-950 block">Estimated Size:</span>
                                <span>{whatAiNoticed.size}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action Steps */}
                      <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                        <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-700" />
                          <span>Recommended Action Steps</span>
                        </h4>
                        <ol className="text-xs text-slate-700 space-y-1.5 list-decimal list-inside">
                          {actionSteps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      {/* Home Care Dos & Don'ts if available */}
                      {patientSummary && (patientSummary.home_care_dos?.length || patientSummary.home_care_donts?.length) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {patientSummary.home_care_dos && patientSummary.home_care_dos.length > 0 && (
                            <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-2">
                              <h5 className="text-xs font-bold text-teal-900 uppercase tracking-wider">
                                At-Home Best Practices
                              </h5>
                              <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                                {patientSummary.home_care_dos.map((d, i) => (
                                  <li key={i}>{d}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {patientSummary.home_care_donts && patientSummary.home_care_donts.length > 0 && (
                            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2">
                              <h5 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                                Things To Avoid
                              </h5>
                              <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                                {patientSummary.home_care_donts.map((d, i) => (
                                  <li key={i}>{d}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Questions to take to your doctor */}
                      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <FileText size={14} className="text-blue-700" />
                          <span>Questions To Ask Your Dermatologist</span>
                        </h4>
                        <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                          {doctorQuestions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty State with Past Reports List */
        <div className="space-y-6">
          <div className="p-8 text-center rounded-3xl border border-dashed border-slate-200 bg-white space-y-4">
            <FileText size={40} className="mx-auto text-slate-300" />
            <div>
              <h3 className="text-base font-bold text-slate-900">No Image Selected for Report Generation</h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto mt-1">
                Upload a dermoscopy image in the analysis workspace, or choose an earlier case from the archive below.
              </p>
            </div>
            <button
              onClick={onNavigateAnalyze}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors"
            >
              Analyze New Image
            </button>
          </div>

          {recentList.length > 0 && (
            <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-4">
              <h4 className="text-sm font-bold text-slate-900">Download Reports for Past Cases</h4>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden text-xs">
                {recentList.map((rec) => (
                  <div key={rec.analysis_id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <span className="font-bold text-slate-800">{rec.top_condition.toUpperCase()}</span>
                      <span className="text-slate-500 ml-2 font-mono text-[11px]">{rec.analysis_id.slice(0, 10)}…</span>
                      <span className="text-slate-500 ml-2">({new Date(rec.created_at).toLocaleDateString()})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectAnalysis(rec.analysis_id)}
                        className="text-sky-600 hover:underline font-semibold"
                      >
                        Inspect
                      </button>
                      <a
                        href={getReportPdfUrl(rec.analysis_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                        title="Download PDF"
                      >
                        <Download size={13} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
