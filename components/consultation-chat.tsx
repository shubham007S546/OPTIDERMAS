'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  AlertCircle,
  Bot,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Edit2,
  ExternalLink,
  FileText,
  Filter,
  History,
  Info,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react'
import {
  sendConversationMessage,
  fetchConversationHistory,
  fetchConversations,
  updateConversationTitle,
  deleteConversation,
  type ConversationCitation,
  type ConversationResponse,
  type ConversationItem,
  type ConversationDetail,
} from '@/lib/api'
import type { PredictResponse } from '@/lib/types'

interface ConsultationChatProps {
  currentResult?: PredictResponse | null
  onOpenCareConnect?: () => void
  onOpenConsultationSummary?: () => void
}

interface Message {
  id: string
  sender: 'user' | 'assistant'
  content: string
  citations?: ConversationCitation[]
  intent?: string
  timestamp: string
}

export function ConsultationChat({
  currentResult,
  onOpenCareConnect,
  onOpenConsultationSummary,
}: ConsultationChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [activeTitle, setActiveTitle] = useState<string>('New Consultation')
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(currentResult?.analysis_id || null)
  const [activeCitation, setActiveCitation] = useState<ConversationCitation | null>(null)
  const [chatMode, setChatMode] = useState<'patient' | 'clinical'>('patient')

  // History Drawer State
  const [historyOpen, setHistoryOpen] = useState(false)
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [searchFilter, setSearchFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'analysis' | 'general'>('all')

  // Inline rename & delete confirmation state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitleText, setEditingTitleText] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const autoStartedAnalysisIdRef = useRef<string | null>(null)

  // Suggested prompt chips based on mode
  const suggestedPrompts = activeAnalysisId
    ? (chatMode === 'patient'
        ? [
            'Explain my results in simple words.',
            'What should I ask my doctor about this?',
            'Is this condition serious or contagious?',
            'What warning signs should I watch out for at home?',
            'Can I apply sunscreen or lotion on this?',
            'What did the AI notice in my skin photo?',
          ]
        : [
            'Explain my result in detail (Segment-wise breakdown).',
            'Why did the model rank this condition first?',
            'Compare the top three differential diagnoses.',
            'Explain the Grad-CAM visualization and its limitations.',
            'What do my morphometric measurements mean?',
            'What does the dermatology literature say about these findings?',
          ])
    : (chatMode === 'patient'
        ? [
            'How do I check my skin for unusual moles at home?',
            'What is the ABCDE rule for skin checks?',
            'How should I choose the right sunscreen for my skin?',
            'What causes sudden dry, itchy skin patches?',
            'What questions should I prepare before seeing a dermatologist?',
          ]
        : [
            'What is eczema, and how is it different from psoriasis?',
            'What commonly causes acne breakouts, and how should I treat it?',
            'How should I build an evidence-based daily skincare routine?',
            'What is the difference between mineral and chemical sunscreen?',
            'What can cause dry, itchy skin, and how is the barrier repaired?',
          ])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Load conversation history list on mount
  const loadConversationsList = async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const list = await fetchConversations({ limit: 50 })
      setConversations(list)
    } catch (err: unknown) {
      setHistoryError(err instanceof Error ? err.message : 'Could not load conversation history.')
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    loadConversationsList()
  }, [])

  // Reset or re-associate conversation when active analysis changes on parent
  useEffect(() => {
    if (currentResult?.analysis_id) {
      setActiveAnalysisId(currentResult.analysis_id)
      // If we don't already have an active conversation, reset
      if (!conversationId) {
        setMessages([])
        setError(null)
        setActiveTitle(`${currentResult.top3[0][0].toUpperCase()} Lesion Consultation`)
      }
    }
  }, [currentResult?.analysis_id])

  // Auto-start consultation turn upon entering view with an active lesion analysis
  useEffect(() => {
    if (currentResult && activeAnalysisId === currentResult.analysis_id) {
      const activeKey = `${currentResult.analysis_id || 'active-result'}-${chatMode}`
      if (autoStartedAnalysisIdRef.current !== activeKey && messages.length === 0 && !loading && !conversationId) {
        autoStartedAnalysisIdRef.current = activeKey
        const prompt =
          chatMode === 'patient'
            ? 'Please explain what my skin lesion analysis found in clear, easy-to-understand language. What does it mean for me, what did the AI notice, and what should my next steps be?'
            : 'Please explain my active skin lesion analysis findings in complete segment-wise clinical detail.'
        handleSend(prompt)
      }
    }
  }, [currentResult, activeAnalysisId, messages.length, loading, conversationId, chatMode])

  const handleSend = async (queryText?: string) => {
    const q = (queryText || input).trim()
    if (!q || loading) return

    setInput('')
    setError(null)

    const userMsgId = 'user-' + Date.now()
    const userMsg: Message = {
      id: userMsgId,
      sender: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const res: ConversationResponse = await sendConversationMessage(q, {
        conversationId,
        analysisId: activeAnalysisId,
        mode: chatMode,
      })

      setConversationId(res.conversation_id)

      const asstMsg: Message = {
        id: 'asst-' + Date.now(),
        sender: 'assistant',
        content: res.answer,
        citations: res.citations,
        intent: res.intent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, asstMsg])
      // Refresh conversation list in background to reflect updated titles & previews
      loadConversationsList()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chat service encountered an error.')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  // Resume an existing conversation
  const handleSelectConversation = async (conv: ConversationItem) => {
    setLoading(true)
    setError(null)
    setHistoryOpen(false)
    try {
      const detail: ConversationDetail = await fetchConversationHistory(conv.id)
      setConversationId(detail.id)
      setActiveTitle(detail.title || 'Consultation Session')
      setActiveAnalysisId(detail.analysis_id || null)

      const mappedMessages: Message[] = (detail.messages || []).map((m) => ({
        id: m.id,
        sender: m.sender.toLowerCase() === 'user' ? 'user' : 'assistant',
        content: m.content,
        citations: m.citations || [],
        intent: m.intent,
        timestamp: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      }))
      setMessages(mappedMessages)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation history.')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  // Start a fresh new consultation without carrying over stale analysis context
  const handleStartFreshConsultation = (attachCurrentAnalysis = false) => {
    setConversationId(null)
    setMessages([])
    setError(null)
    setInput('')
    if (attachCurrentAnalysis && currentResult) {
      setActiveAnalysisId(currentResult.analysis_id || null)
      setActiveTitle(`${currentResult.top3[0][0].toUpperCase()} Lesion Consultation`)
    } else {
      setActiveAnalysisId(null)
      setActiveTitle('General Skin Health Consultation')
    }
    setHistoryOpen(false)
    inputRef.current?.focus()
  }

  // Rename conversation
  const handleRenameSubmit = async (convId: string) => {
    if (!editingTitleText.trim()) {
      setEditingId(null)
      return
    }
    try {
      await updateConversationTitle(convId, editingTitleText.trim())
      if (conversationId === convId) {
        setActiveTitle(editingTitleText.trim())
      }
      setEditingId(null)
      loadConversationsList()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to rename conversation.')
    }
  }

  // Delete conversation
  const handleDeleteConversation = async (convId: string) => {
    try {
      await deleteConversation(convId)
      setDeleteConfirmId(null)
      if (conversationId === convId) {
        handleStartFreshConsultation(false)
      }
      loadConversationsList()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete conversation.')
    }
  }

  // Render markdown-like sections cleanly with clickable citation chips
  const renderFormattedContent = (content: string, citations?: ConversationCitation[]) => {
    const parts = content.split(/(\[CIT-\d+\])/g)

    return (
      <div className="space-y-2 leading-relaxed text-sm">
        {parts.map((part, idx) => {
          const citMatch = part.match(/\[(CIT-\d+)\]/)
          if (citMatch) {
            const citId = citMatch[1]
            const citObj = citations?.find((c) => c.citation_id === citId)
            return (
              <button
                key={idx}
                type="button"
                onClick={() => citObj && setActiveCitation(citObj)}
                className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 hover:bg-sky-500/25 border border-sky-400/30 transition-colors cursor-pointer"
                title={citObj ? `${citObj.title} (${citObj.source})` : 'View clinical citation'}
              >
                <span>{citId}</span>
                <Info size={10} />
              </button>
            )
          }

          const lines = part.split('\n')
          return (
            <span key={idx}>
              {lines.map((line, lIdx) => {
                if (line.startsWith('### ')) {
                  return (
                    <strong
                      key={lIdx}
                      className="block text-foreground font-bold mt-3 mb-1 text-sm border-b border-border/40 pb-0.5"
                    >
                      {line.replace('### ', '')}
                    </strong>
                  )
                }
                if (line.startsWith('• ')) {
                  return (
                    <span key={lIdx} className="block pl-3 text-muted-foreground my-0.5">
                      • {line.slice(2)}
                    </span>
                  )
                }
                return <span key={lIdx}>{line}{lIdx < lines.length - 1 ? '\n' : ''}</span>
              })}
            </span>
          )
        })}
      </div>
    )
  }

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (typeFilter === 'analysis' && !c.analysis_id) return false
    if (typeFilter === 'general' && c.analysis_id) return false
    if (!searchFilter.trim()) return true
    const term = searchFilter.toLowerCase()
    return (
      (c.title && c.title.toLowerCase().includes(term)) ||
      (c.last_message_preview && c.last_message_preview.toLowerCase().includes(term))
    )
  })

  return (
    <div className="flex h-[620px] bg-card rounded-2xl border border-border shadow-sm overflow-hidden relative">
      {/* 1. CONVERSATION HISTORY SIDEBAR / DRAWER */}
      <div
        className={`transition-all duration-200 border-r border-border bg-muted/20 flex flex-col z-20 shrink-0 ${
          historyOpen ? 'w-80 absolute md:relative inset-y-0 left-0 bg-card md:bg-muted/20 shadow-xl md:shadow-none' : 'w-0 overflow-hidden hidden'
        }`}
      >
        {/* History Header */}
        <div className="p-3.5 border-b border-border flex items-center justify-between gap-2 bg-muted/40">
          <div className="flex items-center gap-2">
            <History size={16} className="text-sky-600 dark:text-sky-400" />
            <h3 className="font-bold text-xs text-foreground">Consultation History</h3>
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-muted border border-border font-medium text-muted-foreground">
              {conversations.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen(false)}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Close History Panel"
          >
            <X size={15} />
          </button>
        </div>

        {/* Action: Fresh Consultation */}
        <div className="p-2.5 border-b border-border bg-background space-y-1.5">
          <button
            type="button"
            onClick={() => handleStartFreshConsultation(false)}
            className="w-full py-2 px-3 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus size={14} className="text-sky-600 dark:text-sky-400" />
            <span>New General Consultation</span>
          </button>
          {currentResult && (
            <button
              type="button"
              onClick={() => handleStartFreshConsultation(true)}
              className="w-full py-1.5 px-3 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles size={12} />
              <span>Discuss Current Lesion ({currentResult.top3[0][0].toUpperCase()})</span>
            </button>
          )}
        </div>

        {/* Search & Filter */}
        <div className="p-2.5 border-b border-border space-y-2 bg-muted/10">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search history..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-sky-500 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`flex-1 py-1 rounded-md font-medium text-center transition-colors ${
                typeFilter === 'all'
                  ? 'bg-sky-600 text-white font-bold'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('analysis')}
              className={`flex-1 py-1 rounded-md font-medium text-center transition-colors ${
                typeFilter === 'analysis'
                  ? 'bg-sky-600 text-white font-bold'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Lesion
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('general')}
              className={`flex-1 py-1 rounded-md font-medium text-center transition-colors ${
                typeFilter === 'general'
                  ? 'bg-sky-600 text-white font-bold'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              General
            </button>
          </div>
        </div>

        {/* Scrollable Conversation Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {historyLoading ? (
            <div className="p-8 text-center space-y-2 text-xs text-muted-foreground">
              <Loader2 size={16} className="animate-spin mx-auto text-sky-500" />
              <span>Loading saved sessions...</span>
            </div>
          ) : historyError ? (
            <div className="p-4 text-center space-y-2 text-xs text-destructive">
              <AlertCircle size={16} className="mx-auto" />
              <span>{historyError}</span>
              <button
                type="button"
                onClick={loadConversationsList}
                className="underline block mx-auto text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center space-y-1.5 text-xs text-muted-foreground">
              <MessageCircle size={20} className="mx-auto opacity-40 mb-1" />
              <p className="font-semibold text-foreground">No conversations found</p>
              <p className="text-[11px]">
                {searchFilter ? 'Try clearing your search term.' : 'Your previous consultation turns will appear here.'}
              </p>
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isActive = conversationId === c.id
              const isEditing = editingId === c.id

              return (
                <div
                  key={c.id}
                  className={`group relative p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'border-sky-500/60 bg-sky-500/10 shadow-xs'
                      : 'border-border/70 hover:border-border hover:bg-muted/50 bg-background'
                  }`}
                  onClick={() => !isEditing && handleSelectConversation(c)}
                >
                  <div className="flex items-start justify-between gap-1.5 mb-1">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        c.analysis_id
                          ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {c.analysis_id ? 'Lesion Context' : 'General'}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(c.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  {/* Title or Edit Input */}
                  {isEditing ? (
                    <div
                      className="flex items-center gap-1 my-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editingTitleText}
                        onChange={(e) => setEditingTitleText(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSubmit(c.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRenameSubmit(c.id)}
                        className="p-1 rounded bg-sky-600 text-white hover:bg-sky-500"
                        title="Save title"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1 rounded bg-muted text-muted-foreground hover:text-foreground"
                        title="Cancel"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <h4 className="font-semibold text-foreground text-xs line-clamp-1 mb-1 pr-12">
                      {c.title || 'Consultation Session'}
                    </h4>
                  )}

                  {/* Preview Snippet */}
                  {c.last_message_preview && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {c.last_message_preview}
                    </p>
                  )}

                  {/* Action buttons on hover */}
                  <div
                    className="absolute right-2 top-8 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 p-0.5 rounded-md border border-border/80 shadow-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(c.id)
                        setEditingTitleText(c.title || '')
                      }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Rename conversation"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(c.id)}
                      className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                      title="Delete conversation"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>

                  {/* Delete Confirmation Overlay */}
                  {deleteConfirmId === c.id && (
                    <div
                      className="mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px] space-y-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="font-semibold">Delete consultation history?</p>
                      <p className="text-[10px] text-muted-foreground">The underlying image analysis is not affected.</p>
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteConversation(c.id)}
                          className="px-2 py-0.5 rounded bg-destructive text-destructive-foreground text-[10px] font-bold"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-0.5 rounded bg-muted text-foreground text-[10px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 2. MAIN CONVERSATION CHAT WINDOW */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Console Bar */}
        <div className="p-3.5 border-b border-border bg-muted/40 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              className={`p-1.5 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-semibold shrink-0 ${
                historyOpen
                  ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                  : 'border-border bg-background hover:bg-muted text-foreground'
              }`}
              title="Toggle Consultation History"
            >
              <History size={15} />
              <span className="hidden sm:inline">History</span>
              {conversations.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[10px] font-bold">
                  {conversations.length}
                </span>
              )}
            </button>

            <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-xs shrink-0">
              <Bot size={16} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-foreground truncate">{activeTitle}</span>
                <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                  Dual Persisted
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                {activeAnalysisId ? (
                  <span>Analysis-Aware Mode ({currentResult?.top3[0][0].toUpperCase() || 'Lesion Context Attached'})</span>
                ) : (
                  <span>General Skin Health Mode (Evidence-Grounded Education)</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mode Switcher: Patient vs Specialist */}
            <div className="flex items-center rounded-xl bg-background border border-border p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setChatMode('patient')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  chatMode === 'patient'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Conversational, empathetic, plain-language patient explanations"
              >
                <Sparkles size={11} />
                <span>Patient</span>
              </button>
              <button
                type="button"
                onClick={() => setChatMode('clinical')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  chatMode === 'clinical'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Deep clinical segment-wise breakdown, Grad-CAM, morphometrics & research literature"
              >
                <Bot size={11} />
                <span>Specialist</span>
              </button>
            </div>

            {onOpenConsultationSummary && activeAnalysisId && (
              <button
                type="button"
                onClick={onOpenConsultationSummary}
                className="px-2.5 py-1 text-xs rounded-lg border border-border bg-background hover:bg-muted font-medium text-foreground flex items-center gap-1 transition-colors"
              >
                <FileText size={12} className="text-primary" />
                <span className="hidden md:inline">Consultation Packet</span>
              </button>
            )}

            {onOpenCareConnect && (
              <button
                type="button"
                onClick={onOpenCareConnect}
                className="px-2.5 py-1 text-xs rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 font-medium text-sky-700 dark:text-sky-300 flex items-center gap-1 transition-colors"
              >
                <Calendar size={12} />
                <span className="hidden md:inline">Find Dermatologist</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleStartFreshConsultation(false)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Start brand new consultation"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Sparkles size={24} />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="font-bold text-sm text-foreground">
                  {chatMode === 'patient'
                    ? (activeAnalysisId ? 'Ask About Your Skin Findings in Plain English' : 'Ask Any Everyday Skin Question')
                    : (activeAnalysisId ? 'Discuss Your Skin Findings' : 'Ask Any Skin Health Question')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {chatMode === 'patient'
                    ? (activeAnalysisId
                        ? 'Understand what the AI noticed, whether it is concerning, and practical steps you can take.'
                        : 'Ask about acne, rashes, dry patches, sunscreen choices, or preparing for your doctor.')
                    : (activeAnalysisId
                        ? 'Grounded in your image analysis, Grad-CAM attention maps, and verified dermatology literature.'
                        : 'Ask about acne, eczema, psoriasis, skincare routines, or clinical differential protocols.')}
                </p>
              </div>

              {/* Quick Suggested Prompt Chips */}
              <div className="flex flex-wrap gap-1.5 justify-center max-w-lg mt-2">
                {suggestedPrompts.slice(0, 4).map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(p)}
                    className="px-2.5 py-1.5 text-xs rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-left flex items-center gap-1 shadow-sm"
                  >
                    <ChevronRight size={12} className="text-sky-500 shrink-0" />
                    <span>{p}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5 text-xs">
                    <Bot size={15} />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 shadow-sm ${
                    m.sender === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-none'
                      : 'bg-muted/60 border border-border/80 text-foreground rounded-tl-none'
                  }`}
                >
                  {m.sender === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <div>
                      {renderFormattedContent(m.content, m.citations)}

                      {/* Citations Footer */}
                      {m.citations && m.citations.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-border/60 flex flex-wrap gap-1.5 items-center">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
                            Grounded Citations:
                          </span>
                          {m.citations.map((c) => (
                            <button
                              key={c.citation_id}
                              type="button"
                              onClick={() => setActiveCitation(c)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-background hover:bg-muted border border-border text-foreground transition-colors cursor-pointer"
                            >
                              <span className="text-sky-600 dark:text-sky-400 font-bold">[{c.citation_id}]</span>
                              <span className="max-w-[130px] truncate">{c.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <span className="block text-[9px] opacity-60 text-right mt-1.5">
                    {m.timestamp}
                  </span>
                </div>

                {m.sender === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5 text-xs">
                    <User size={15} />
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-2.5 justify-start">
              <div className="w-7 h-7 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 text-xs">
                <Bot size={15} />
              </div>
              <div className="bg-muted/60 border border-border/80 rounded-2xl rounded-tl-none p-3.5 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={14} className="animate-spin text-sky-500" />
                <span>Evaluating clinical literature & preparing response...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={() => handleSend()}
                className="text-xs underline font-semibold hover:opacity-80"
              >
                Retry
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-border bg-background">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                chatMode === 'patient'
                  ? (activeAnalysisId
                      ? 'Ask in plain English (e.g. "What did the AI see?", "Is this dangerous?")...'
                      : 'Ask any skin question (e.g. "Best sunscreen for sensitive skin", "Why does my mole itch?")...')
                  : (activeAnalysisId
                      ? 'Ask about differential ranking, Grad-CAM, morphometrics...'
                      : 'Ask a skin health question (e.g. eczema vs psoriasis, acne routine)...')
              }
              disabled={loading}
              className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-border bg-muted/30 focus:outline-none focus:ring-1 focus:ring-sky-500 text-foreground placeholder:text-muted-foreground disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white transition-colors cursor-pointer"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>

      {/* Slide-out Citation Modal */}
      {activeCitation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold text-xs">
                  {activeCitation.citation_id}
                </span>
                <h4 className="text-base font-bold text-foreground mt-2 leading-snug">
                  {activeCitation.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeCitation.source} ({activeCitation.publication_year || 'Recent'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveCitation(null)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/50 border border-border/80 space-y-1.5 text-xs">
              <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider block">
                Evidence Level & Source Excerpt
              </span>
              <p className="text-foreground leading-relaxed">
                {activeCitation.snippet || 'Peer-reviewed clinical practice guideline verified in OptiDerma RAG repository.'}
              </p>
              <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Classification: {activeCitation.evidence_level || 'Practice Guideline'}</span>
                {activeCitation.url && (
                  <a
                    href={activeCitation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-semibold"
                  >
                    <span>View PubMed / Journal</span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setActiveCitation(null)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors"
              >
                Close Citation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
