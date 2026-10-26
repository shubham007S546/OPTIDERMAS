'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  X,
  Search,
  MapPin,
  Calendar,
  Phone,
  ExternalLink,
  FileText,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
  ChevronRight,
  User,
  Mail,
  Building2,
  Sparkles,
  CalendarPlus,
  Printer,
} from 'lucide-react'
import {
  searchDermatologists,
  submitAppointmentRequest,
  fetchAppointmentRequests,
  generateConsultationSummary,
  type ClinicProvider,
  type AppointmentRequestPayload,
} from '@/lib/api'
import type { PredictResponse } from '@/lib/types'

interface CareConnectDialogProps {
  open: boolean
  onClose: () => void
  currentResult?: PredictResponse | null
  initialTab?: 'search' | 'request' | 'summary' | 'history'
}

export function CareConnectDialog({
  open,
  onClose,
  currentResult,
  initialTab = 'search',
}: CareConnectDialogProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'request' | 'summary' | 'history'>(initialTab)

  // Search state
  const [searchPin, setSearchPin] = useState('')
  const [searchCity, setSearchCity] = useState('')
  const [consultTypeFilter, setConsultTypeFilter] = useState<'all' | 'in_person' | 'teleconsult'>('all')
  const [clinics, setClinics] = useState<ClinicProvider[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchPerformed, setSearchPerformed] = useState(false)

  // Appointment Request state
  const [selectedClinic, setSelectedClinic] = useState<ClinicProvider | null>(null)
  const [patientName, setPatientName] = useState('')
  const [patientEmail, setPatientEmail] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [patientPin, setPatientPin] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [consultationType, setConsultationType] = useState('both')
  const [reason, setReason] = useState('')
  const [userConsent, setUserConsent] = useState(false)
  const [attachSummary, setAttachSummary] = useState(true)
  const [requestSubmitting, setRequestSubmitting] = useState(false)
  const [requestSuccess, setRequestSuccess] = useState<{ id: string; status: string } | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)

  // Consultation Summary state
  const [summaryMarkdown, setSummaryMarkdown] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryCopied, setSummaryCopied] = useState(false)

interface CareHistoryItem {
  id: string
  patient_name: string
  status: string
  clinic_name?: string
  consultation_type: string
  preferred_date: string
  created_at?: string
  [key: string]: unknown
}

  // Request History state
  const [historyList, setHistoryList] = useState<CareHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Load initial search on open
  const runSearch = useCallback(async (pin = searchPin, city = searchCity, type = consultTypeFilter) => {
    setSearchLoading(true)
    setSearchPerformed(true)
    try {
      const res = await searchDermatologists({
        pin_code: pin.trim() || undefined,
        city: city.trim() || undefined,
        consultation_type: type === 'all' ? undefined : type,
      })
      setClinics(res.results || [])
    } catch {
      setClinics([])
    } finally {
      setSearchLoading(false)
    }
  }, [searchPin, searchCity, consultTypeFilter])

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab)
      runSearch()
    }
  }, [open, initialTab, runSearch])

  // Load or generate consultation summary
  const loadSummary = useCallback(async () => {
    if (!currentResult?.analysis_id) {
      setSummaryMarkdown(
        `# Pre-Consultation Dermatology Visit Sheet\n\n` +
        `**Status**: No image analysis attached. General consultation preparation.\n\n` +
        `### Key Questions to Ask Your Dermatologist:\n` +
        `1. When did this spot or rash first appear, and has it changed in size, shape, or color?\n` +
        `2. Are there symptoms like itching, pain, tenderness, or bleeding?\n` +
        `3. Does this lesion require dermoscopy, biopsy, or regular photographic surveillance?\n` +
        `4. What skincare routine, cleansers, or sunscreens should I use for this area?\n` +
        `5. Are there warning signs (ABCDE criteria) that should prompt immediate re-evaluation?\n\n` +
        `### Notes & Medication History:\n` +
        `- Current medications:\n- Previous skin conditions or family history:\n- Daily sunscreen use:`
      )
      return
    }

    setSummaryLoading(true)
    try {
      const res = await generateConsultationSummary(currentResult.analysis_id)
      setSummaryMarkdown(res.summary_markdown)
    } catch {
      setSummaryMarkdown(
        `# Consultation Summary Packet — OptiDerma\n\n` +
        `**Analysis ID**: \`${currentResult.analysis_id}\`\n` +
        `**Top Primary Finding**: ${currentResult.top3?.[0]?.[0] || 'Unspecified'} (${Math.round((currentResult.top3?.[0]?.[1] || 0) * 100)}% confidence)\n` +
        `**Risk Level**: ${currentResult.risk?.level || 'Review Recommended'}\n` +
        `**Recommendation**: ${currentResult.risk?.recommendation || 'Consult a certified dermatologist.'}\n\n` +
        `### Questions for the Dermatologist:\n` +
        `1. Does this lesion show atypical dermoscopic features under polarized light?\n` +
        `2. Would you recommend a punch/shave biopsy or digital dermoscopy monitoring in 3 months?\n` +
        `3. What benign mimics (e.g., seborrheic keratosis, dermatofibroma) should be considered?`
      )
    } finally {
      setSummaryLoading(false)
    }
  }, [currentResult])

  useEffect(() => {
    if (open && activeTab === 'summary') {
      loadSummary()
    }
  }, [open, activeTab, loadSummary])

  // Load history
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetchAppointmentRequests()
      setHistoryList(res.requests || [])
    } catch {
      setHistoryList([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && activeTab === 'history') {
      loadHistory()
    }
  }, [open, activeTab, loadHistory])

  // Submit appointment request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patientName.trim() || !patientEmail.trim() || !preferredDate) {
      setRequestError('Please fill in required fields: Name, Email, and Preferred Date.')
      return
    }
    if (!userConsent) {
      setRequestError('Please confirm the consent checkbox before submitting your request.')
      return
    }

    setRequestSubmitting(true)
    setRequestError(null)
    try {
      const payload: AppointmentRequestPayload = {
        analysis_id: currentResult?.analysis_id || null,
        patient_name: patientName.trim(),
        contact_email: patientEmail.trim(),
        contact_phone: patientPhone.trim() || undefined,
        pin_code: patientPin.trim() || undefined,
        clinic_id: selectedClinic?.id || undefined,
        clinic_name: selectedClinic ? `${selectedClinic.name} (${selectedClinic.institution})` : undefined,
        preferred_date: preferredDate,
        consultation_type: consultationType,
        reason: reason.trim() || undefined,
        consultation_summary: attachSummary && summaryMarkdown ? summaryMarkdown : undefined,
        user_consent: userConsent,
      }

      const res = await submitAppointmentRequest(payload)
      setRequestSuccess({ id: res.request_id, status: res.status })
    } catch (err: unknown) {
      setRequestError((err as Error)?.message || 'Failed to submit request. Please try again.')
    } finally {
      setRequestSubmitting(false)
    }
  }

  const copySummary = () => {
    navigator.clipboard.writeText(summaryMarkdown)
    setSummaryCopied(true)
    setTimeout(() => setSummaryCopied(false), 2000)
  }

  const downloadSummary = () => {
    const blob = new Blob([summaryMarkdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `OptiDerma_Consultation_Packet_${currentResult?.analysis_id?.slice(0, 8) || 'visit'}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadAppointmentIcs = () => {
    if (!preferredDate) return
    const clinicName = selectedClinic?.name || 'Dermatology Consultation'
    const address = selectedClinic?.address || 'Partner Dermatology Clinic'
    const cleanDate = preferredDate.replace(/-/g, '')
    const startStr = `${cleanDate}T100000Z`
    const endStr = `${cleanDate}T104500Z`

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//OptiDerma//CareConnect//EN',
      'BEGIN:VEVENT',
      `UID:optiderma-appt-${requestSuccess?.id || Date.now()}@optiderma.ai`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:Dermatology Appointment: ${clinicName}`,
      `LOCATION:${address}`,
      `DESCRIPTION:Appointment Request Ref: ${requestSuccess?.id || 'OD-APPT'}\\nPatient: ${patientName}\\nFacility: ${clinicName}\\nAddress: ${address}\\nPreparation: Do not apply makeup or creams to the examined area. Bring OptiDerma scan summary.`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT24H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder: Dermatologist appointment tomorrow',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `dermatology-appointment-${preferredDate}.ics`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white text-slate-900 border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
              <Building2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">OptiDerma Care Connect</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Verified Clinics & OPD
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Location-based dermatologist discovery, care coordination, and consultation packets.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-2 border-b border-slate-200 bg-slate-50/40 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('search')}
            className={`pb-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'search'
                ? 'border-blue-700 text-blue-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Search size={14} />
            1. Find Dermatologists
          </button>
          <button
            onClick={() => setActiveTab('request')}
            className={`pb-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'request'
                ? 'border-blue-700 text-blue-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Calendar size={14} />
            2. Request Appointment
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`pb-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'summary'
                ? 'border-blue-700 text-blue-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText size={14} />
            3. Consultation Summary Packet
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-blue-700 text-blue-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Clock size={14} />
            4. My Requests
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {/* TAB 1: SEARCH DERMATOLOGISTS */}
          {activeTab === 'search' && (
            <div className="space-y-6">
              {/* Search Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
                <div className="sm:col-span-4 relative">
                  <MapPin size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchPin}
                    onChange={(e) => setSearchPin(e.target.value)}
                    placeholder="PIN Code (e.g. 175121, 110029)"
                    className="w-full pl-10 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 font-medium"
                  />
                </div>
                <div className="sm:col-span-4 relative">
                  <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                    placeholder="City or District (e.g. Mandi, Delhi)"
                    className="w-full pl-10 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 font-medium"
                  />
                </div>
                <div className="sm:col-span-2">
                  <select
                    value={consultTypeFilter}
                    onChange={(e) => setConsultTypeFilter(e.target.value as 'all' | 'in_person' | 'teleconsult')}
                    aria-label="Filter by consultation type"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                  >
                    <option value="all">All Types</option>
                    <option value="in_person">In-Person</option>
                    <option value="teleconsult">Teleconsult</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <button
                    onClick={() => runSearch()}
                    disabled={searchLoading}
                    className="w-full py-2 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                  >
                    {searchLoading ? 'Searching…' : 'Search'}
                  </button>
                </div>
              </div>

              {/* Notice Banner */}
              <div className="p-3.5 rounded-2xl border border-blue-200 bg-blue-50/70 text-xs text-blue-900 flex items-start gap-3">
                <ShieldCheck size={18} className="text-blue-700 shrink-0 mt-0.5" />
                <p>
                  Directory includes verified dermatology departments at premier teaching hospitals, tertiary medical centers, and teleconsultation clinics. Appointments can be scheduled directly or coordinated via OptiDerma request.
                </p>
              </div>

              {/* Clinic Cards */}
              {clinics.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clinics.map((clinic) => (
                    <div
                      key={clinic.id}
                      className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between shadow-xs"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-sm font-bold text-slate-900 leading-snug">{clinic.name}</h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                              clinic.consultation_types.includes('teleconsult') && clinic.consultation_types.includes('in-person')
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : clinic.consultation_types.includes('teleconsult')
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {clinic.consultation_types.includes('teleconsult') && clinic.consultation_types.includes('in-person')
                              ? 'In-Person & Tele'
                              : clinic.consultation_types.includes('teleconsult')
                              ? 'Teleconsultation'
                              : 'In-Person Only'}
                          </span>
                        </div>

                        <p className="text-xs text-blue-700 font-semibold mb-2">
                          {clinic.institution}
                        </p>

                        <div className="space-y-1.5 text-[11px] text-slate-600 mb-3">
                          <p className="flex items-start gap-1.5">
                            <MapPin size={13} className="shrink-0 text-slate-400 mt-0.5" />
                            <span>
                              {clinic.address}, {clinic.city} ({clinic.pin_code})
                            </span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Phone size={13} className="shrink-0 text-slate-400" />
                            <a href={`tel:${clinic.phone}`} className="hover:underline font-medium text-slate-800">
                              {clinic.phone}
                            </a>
                          </p>
                          <p className="text-slate-500 font-medium">Hours: {clinic.hours}</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        {clinic.portal_url && (
                          <a
                            href={clinic.portal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline"
                          >
                            Hospital Portal <ExternalLink size={11} />
                          </a>
                        )}
                        <button
                          onClick={() => {
                            setSelectedClinic(clinic)
                            setPatientPin(clinic.pin_code)
                            setActiveTab('request')
                          }}
                          className="ml-auto inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition-colors"
                        >
                          Request Visit <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center border border-dashed border-slate-200 rounded-3xl bg-white shadow-2xs space-y-2">
                  <MapPin size={32} className="mx-auto text-slate-400 mb-1" />
                  <p className="text-sm font-bold text-slate-800">No Local Clinics Found Matching Criteria</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Try entering your district, or explore verified state tertiary referral centers and National Tele-Dermatology.
                  </p>
                  <button
                    onClick={() => {
                      setSearchPin('')
                      setSearchCity('')
                      setConsultTypeFilter('all')
                      runSearch('', '', 'all')
                    }}
                    className="mt-2 text-xs text-blue-700 font-bold hover:underline"
                  >
                    View All Partner Centers
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REQUEST APPOINTMENT */}
          {activeTab === 'request' && (
            <div>
              {requestSuccess ? (
                <div className="py-6 text-center max-w-lg mx-auto space-y-5 animate-in fade-in duration-200">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 size={32} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-foreground">Appointment Request Logged</h3>
                    <p className="text-xs text-muted-foreground">
                      Status:{' '}
                      <strong className="text-emerald-600 uppercase font-bold">{requestSuccess.status}</strong> • Confirmation ID:{' '}
                      <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">{requestSuccess.id}</code>
                    </p>
                  </div>

                  {/* Summary of appointment */}
                  <div className="p-4 rounded-2xl border border-border bg-muted/40 text-left text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-muted-foreground">Preferred Date:</span>
                      <strong className="text-foreground">{preferredDate || 'Upcoming Week'}</strong>
                    </div>
                    {selectedClinic && (
                      <div className="flex items-start justify-between gap-2 pt-1 border-t border-border/50">
                        <span className="font-semibold text-muted-foreground shrink-0">Clinic / Hospital:</span>
                        <span className="text-right text-foreground font-medium">{selectedClinic.name} ({selectedClinic.address})</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <span className="font-semibold text-muted-foreground">Consultation Type:</span>
                      <span className="text-foreground capitalize">{consultationType.replace('_', ' ')}</span>
                    </div>
                  </div>

                  {/* Calendar & Print Quick Actions */}
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleDownloadAppointmentIcs}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      <CalendarPlus size={14} />
                      <span>Add to My Calendar (.ics)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border hover:bg-muted text-foreground font-semibold text-xs transition-colors"
                    >
                      <Printer size={14} />
                      <span>Print Confirmation Slip</span>
                    </button>
                  </div>

                  {/* Patient Preparation Checklist */}
                  <div className="p-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-left space-y-2">
                    <span className="text-xs font-bold text-sky-900 dark:text-sky-200 block">
                      Preparation Tips for Your Dermatologist Visit:
                    </span>
                    <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                      <li><strong>Clean Skin:</strong> Do not wear makeup, concealer, or body lotions on the spot to be checked.</li>
                      <li><strong>Photos Ready:</strong> Have your OptiDerma ID or saved photos handy to show the doctor your timeline.</li>
                      <li><strong>List Symptoms:</strong> Mention any itching, tenderness, or bleeding even if mild.</li>
                    </ul>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => setActiveTab('history')}
                      className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-500 transition-colors shadow-xs"
                    >
                      View in My Requests
                    </button>
                    <button
                      onClick={() => {
                        setRequestSuccess(null)
                        setActiveTab('search')
                      }}
                      className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-colors"
                    >
                      Back to Directory
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitRequest} className="space-y-4 max-w-2xl mx-auto">
                  {selectedClinic && (
                    <div className="p-3 rounded-xl border border-sky-500/30 bg-sky-500/5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-foreground">Selected Facility:</span>{' '}
                        <strong>{selectedClinic.name}</strong> ({selectedClinic.institution})
                        <p className="text-muted-foreground text-[11px]">{selectedClinic.address}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedClinic(null)}
                        className="text-xs text-muted-foreground hover:text-foreground underline ml-2"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Patient Full Name *
                      </label>
                      <div className="relative">
                        <User size={14} className="absolute left-3 top-3 text-muted-foreground" />
                        <input
                          type="text"
                          required
                          value={patientName}
                          onChange={(e) => setPatientName(e.target.value)}
                          placeholder="e.g. Shubham Sharma"
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-background focus:ring-2 focus:ring-sky-500/40"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Contact Email *
                      </label>
                      <div className="relative">
                        <Mail size={14} className="absolute left-3 top-3 text-muted-foreground" />
                        <input
                          type="email"
                          required
                          value={patientEmail}
                          onChange={(e) => setPatientEmail(e.target.value)}
                          placeholder="patient@example.com"
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-background focus:ring-2 focus:ring-sky-500/40"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Phone (Optional)</label>
                      <div className="relative">
                        <Phone size={14} className="absolute left-3 top-3 text-muted-foreground" />
                        <input
                          type="tel"
                          value={patientPhone}
                          onChange={(e) => setPatientPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-background focus:ring-2 focus:ring-sky-500/40"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Preferred Date *</label>
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-3 text-muted-foreground" />
                        <input
                          type="date"
                          required
                          value={preferredDate}
                          min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                          onChange={(e) => setPreferredDate(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-background focus:ring-2 focus:ring-sky-500/40"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Consultation Type</label>
                      <select
                        value={consultationType}
                        onChange={(e) => setConsultationType(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:ring-2 focus:ring-sky-500/40"
                      >
                        <option value="both">First Available</option>
                        <option value="in_person">In-Person Clinic Visit</option>
                        <option value="teleconsult">Online Teleconsultation</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Reason for Visit / Symptoms Description
                    </label>
                    <textarea
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Briefly describe the spot, rash, how long it has been present, changes in size/color, or whether it itches/bleeds..."
                      className="w-full p-3 text-xs rounded-lg border border-border bg-background focus:ring-2 focus:ring-sky-500/40"
                    />
                  </div>

                  {currentResult?.analysis_id && (
                    <div className="p-3 rounded-xl border border-border bg-muted/30 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-sky-500 shrink-0" />
                        <div>
                          <p className="font-semibold text-foreground">Attach OptiDerma AI Analysis Packet</p>
                          <p className="text-[11px] text-muted-foreground">
                            Includes model differential ({currentResult.top3?.[0]?.[0] || 'lesion'}), confidence, and Grad-CAM observations.
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={attachSummary}
                        onChange={(e) => setAttachSummary(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-sky-600 focus:ring-sky-500"
                      />
                    </div>
                  )}

                  {/* Consent Checkbox */}
                  <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs space-y-2">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        required
                        checked={userConsent}
                        onChange={(e) => setUserConsent(e.target.checked)}
                        className="h-4 w-4 mt-0.5 rounded border-amber-500/40 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-[11px] text-foreground leading-snug">
                        <strong>Patient Acknowledgment & Consent</strong>: I understand OptiDerma provides clinical decision support and triage coordination, not a final medical diagnosis. My request will be forwarded to the clinic coordination queue with status <strong>Pending</strong>. I agree to share my consultation notes with the medical provider.
                      </span>
                    </label>
                  </div>

                  {requestError && (
                    <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                      <AlertCircle size={15} className="shrink-0" />
                      <span>{requestError}</span>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('search')}
                      className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted"
                    >
                      Browse Clinics
                    </button>
                    <button
                      type="submit"
                      disabled={requestSubmitting}
                      className="px-5 py-2 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {requestSubmitting ? 'Submitting Request...' : 'Submit Appointment Request'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 3: CONSULTATION SUMMARY PACKET */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-border bg-muted/20">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Doctor Consultation Packet</h3>
                  <p className="text-xs text-muted-foreground">
                    Review and edit this summary packet before your appointment. You can copy or download it.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copySummary}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors"
                  >
                    {summaryCopied ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    {summaryCopied ? 'Copied' : 'Copy Text'}
                  </button>
                  <button
                    onClick={downloadSummary}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors"
                  >
                    <Download size={13} />
                    Download (.md)
                  </button>
                </div>
              </div>

              {summaryLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Generating structured clinical summary...
                </div>
              ) : (
                <div className="relative">
                  <textarea
                    rows={16}
                    value={summaryMarkdown}
                    onChange={(e) => setSummaryMarkdown(e.target.value)}
                    className="w-full p-4 text-xs font-mono rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40 leading-relaxed resize-y"
                  />
                  <div className="text-[10px] text-muted-foreground mt-1 flex justify-between">
                    <span>Editable Markdown — you may add your medication history or specific symptoms above.</span>
                    <span>{summaryMarkdown.length} characters</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MY REQUESTS HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Appointment Requests History</h3>
                  <p className="text-xs text-muted-foreground">
                    Track the status of your care coordination requests.
                  </p>
                </div>
                <button
                  onClick={loadHistory}
                  disabled={historyLoading}
                  className="text-xs text-sky-600 font-semibold hover:underline"
                >
                  {historyLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {historyList.length > 0 ? (
                <div className="space-y-3">
                  {historyList.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{req.patient_name}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              req.status === 'Pending'
                                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                : req.status === 'Confirmed'
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {req.clinic_name || 'General Specialist Referral'} • {req.consultation_type}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Preferred Date: <strong>{req.preferred_date}</strong> • Ref: <code className="text-[10px] font-mono">{req.id.slice(0, 8)}</code>
                        </p>
                      </div>

                      <div className="text-right text-[11px] text-muted-foreground">
                        <span>Submitted on {req.created_at ? new Date(req.created_at).toLocaleDateString() : 'Recent'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center border border-dashed border-border rounded-xl">
                  <Clock size={32} className="mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-semibold text-foreground">No appointment requests yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    When you request an appointment with a clinic, it will appear here.
                  </p>
                  <button
                    onClick={() => setActiveTab('search')}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-500"
                  >
                    Find a Dermatologist
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
