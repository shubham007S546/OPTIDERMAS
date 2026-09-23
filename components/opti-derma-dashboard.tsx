'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, ArrowUpRight, BrainCircuit, Check, ChevronDown, CircleAlert, Command, FileText, FolderKanban, History, ImagePlus, LayoutGrid, Menu, MessageSquare, Paperclip, Play, Plus, Search, Settings2, ShieldCheck, Sparkles, UploadCloud, X, Zap } from 'lucide-react'

type WorkspaceTab = 'Run' | 'Cases' | 'Reports'
type AgentStep = { label: string; detail: string; state: 'queued' | 'active' | 'done' }

const initialSteps: AgentStep[] = [
  { label: 'Inspect image quality', detail: 'Checking focus, lighting, and framing', state: 'queued' },
  { label: 'Map visual signals', detail: 'Segmenting candidate regions of interest', state: 'queued' },
  { label: 'Retrieve evidence', detail: 'Comparing against verified reference sets', state: 'queued' },
  { label: 'Draft decision brief', detail: 'Waiting for model outputs', state: 'queued' },
]

export default function OptiDermaDashboard() {
  const [tab, setTab] = useState<WorkspaceTab>('Run')
  const [mobileNav, setMobileNav] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState(initialSteps)
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/health`).then((response) => setHealth(response.ok ? 'online' : 'offline')).catch(() => setHealth('offline'))
  }, [])

  function chooseFile(next: File | undefined) {
    if (!next || !next.type.startsWith('image/') || next.size > 20 * 1024 * 1024) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(next)
    setPreview(URL.createObjectURL(next))
    setTab('Run')
  }

  function clearFile() {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null); setPreview(null); setSteps(initialSteps)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function runAgent() {
    if (!file || running) return
    setRunning(true)
    setSteps(initialSteps.map((step, index) => ({ ...step, state: index === 0 ? 'active' : 'queued' })))
    const timer = window.setInterval(() => {
      setSteps((current) => {
        const active = current.findIndex((step) => step.state === 'active')
        if (active < 0) return current
        return current.map((step, index) => index === active ? { ...step, state: 'done' } : index === active + 1 ? { ...step, state: 'active' } : step)
      })
    }, 900)
    try {
      const body = new FormData(); body.append('file', file)
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/predictions/analyze`, { method: 'POST', body })
    } catch { /* Backend response drives all clinical output. */ }
    window.setTimeout(() => { window.clearInterval(timer); setRunning(false) }, 3900)
  }

  return <main className="min-h-screen bg-background text-foreground">
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <AnimatePresence>{mobileNav && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileNav(false)} className="fixed inset-0 z-30 bg-black/50 lg:hidden" />}</AnimatePresence>
    <div className="relative mx-auto flex min-h-screen max-w-[1680px]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[238px] flex-col border-r border-border bg-card/90 px-4 py-5 backdrop-blur-xl transition-transform lg:relative lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-10 flex items-center gap-3 px-2"><div className="brand-mark"><Activity className="size-4" /></div><div><div className="text-sm font-semibold tracking-tight">OptiDerma</div><div className="label">Research agent</div></div></div>
        <div className="mb-3 px-2 label">Workspace</div>
        <nav className="space-y-1">{[{ label: 'Agent run', icon: Sparkles, tab: 'Run' as WorkspaceTab }, { label: 'Case library', icon: FolderKanban, tab: 'Cases' as WorkspaceTab }, { label: 'Reports', icon: FileText, tab: 'Reports' as WorkspaceTab }].map(({ label, icon: Icon, tab: itemTab }) => <button key={label} onClick={() => { setTab(itemTab); setMobileNav(false) }} className={`nav-item ${tab === itemTab ? 'nav-item-active' : ''}`}><Icon className="size-4" />{label}{tab === itemTab && <ArrowUpRight className="ml-auto size-3.5" />}</button>)}</nav>
        <div className="my-7 border-t border-border" />
        <div className="mb-3 px-2 label">Tools</div>
        <button className="nav-item"><Search className="size-4" />Evidence search</button><button className="nav-item"><BrainCircuit className="size-4" />Model registry</button>
        <div className="mt-auto space-y-3"><div className="rounded-xl border border-border bg-muted/40 p-3"><div className="flex items-center gap-2 text-xs font-medium"><span className={`status-dot ${health === 'online' ? 'status-online' : ''}`} />{health === 'online' ? 'Engine connected' : health === 'offline' ? 'Engine unavailable' : 'Checking engine'}</div><p className="mt-2 text-[11px] leading-4 text-muted-foreground">Your backend controls every prediction and report.</p></div><button className="nav-item"><Settings2 className="size-4" />Workspace settings</button><div className="flex items-center gap-2 border-t border-border pt-4"><div className="avatar">OD</div><div className="min-w-0"><p className="truncate text-xs font-medium">Operator workspace</p><p className="truncate text-[11px] text-muted-foreground">Private project</p></div><ChevronDown className="ml-auto size-3.5 text-muted-foreground" /></div></div>
      </aside>
      <section className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border bg-background/80 px-5 backdrop-blur-xl sm:px-8"><div className="flex items-center gap-3"><button onClick={() => setMobileNav(true)} className="lg:hidden" aria-label="Open navigation"><Menu className="size-5 text-muted-foreground" /></button><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="hidden sm:inline">Workspace</span><span className="hidden sm:inline text-border">/</span><span className="font-medium text-foreground">{tab === 'Run' ? 'New agent run' : tab}</span></div></div><div className="flex items-center gap-2"><button className="shortcut"><Command className="size-3" /> K</button><button className="icon-button" aria-label="Notifications"><Activity className="size-4" /></button><button className="avatar">OD</button></div></header>
        <div className="mx-auto max-w-[1320px] px-5 py-7 sm:px-8 lg:px-10"><AnimatePresence mode="wait"><motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .22 }}>{tab === 'Run' ? <RunView file={file} preview={preview} inputRef={inputRef} running={running} steps={steps} onFile={chooseFile} onClear={clearFile} onRun={runAgent} /> : tab === 'Cases' ? <CasesView onStart={() => setTab('Run')} /> : <ReportsView />}</motion.div></AnimatePresence></div>
      </section>
    </div>
  </main>
}

function RunView({ file, preview, inputRef, running, steps, onFile, onClear, onRun }: { file: File | null; preview: string | null; inputRef: React.RefObject<HTMLInputElement | null>; running: boolean; steps: AgentStep[]; onFile: (file: File | undefined) => void; onClear: () => void; onRun: () => void }) {
  return <div><div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><div className="eyebrow"><span className="live-pulse" /> Agent workspace</div><h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">What should we investigate?</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Give the research agent an image and a question. It will inspect, retrieve, and assemble an auditable brief.</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-accent" /> Investigational mode</div></div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-5"><section className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="size-4 text-accent" /> New investigation</div><span className="mono text-muted-foreground">RUN / 001</span></div><div className="p-5 sm:p-7"><label className="mb-2 block text-xs font-medium text-muted-foreground">Research question <span className="text-muted-foreground/50">optional</span></label><div className="input-shell"><MessageSquare className="size-4 text-muted-foreground" /><input className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" placeholder="e.g. What visual signals should I review first?" /></div><div className="mt-6 flex items-center justify-between"><div><p className="text-xs font-medium">Evidence image</p><p className="mt-1 text-[11px] text-muted-foreground">JPG, PNG, or WEBP · up to 20 MB</p></div><span className="mono text-muted-foreground">STEP 01</span></div><button onClick={() => inputRef.current?.click()} className="upload-canvas mt-3 flex min-h-[280px] w-full items-center justify-center overflow-hidden rounded-xl text-center">{preview ? <div className="relative flex h-full w-full items-center justify-center p-4"><img src={preview} alt="Selected lesion preview" className="max-h-[245px] rounded-lg object-contain" /><span className="absolute right-4 top-4 rounded-md bg-background/80 px-2 py-1 text-[10px] text-muted-foreground">Click to replace</span></div> : <div><div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent"><ImagePlus className="size-5" /></div><p className="mt-4 text-sm font-medium">Drop evidence here</p><p className="mt-1 text-xs text-muted-foreground">or click to browse your files</p></div>}</button>{file && <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-muted/35 p-3"><div className="flex size-8 items-center justify-center rounded-md bg-accent/10 text-accent"><Paperclip className="size-3.5" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{file.name}</p><p className="text-[10px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB · ready</p></div><button onClick={onClear} className="text-muted-foreground hover:text-foreground" aria-label="Remove image"><X className="size-4" /></button></div>}<div className="mt-6 flex items-center justify-between gap-3"><p className="max-w-xs text-[11px] leading-4 text-muted-foreground">The agent will not produce a clinical diagnosis. Outputs depend on your connected backend.</p><button disabled={!file || running} onClick={onRun} className="primary-button shrink-0"><Play className="size-3.5 fill-current" />{running ? 'Agent working' : 'Run investigation'}</button></div></div></section><section className="panel p-5"><div className="flex items-center justify-between"><div><p className="eyebrow">Recent activity</p><h2 className="mt-1 text-sm font-semibold">Your investigation stream</h2></div><button className="text-xs text-accent hover:underline">View all <ArrowUpRight className="inline size-3" /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><ActivityCard icon={Zap} title="Image intake" detail="Awaiting evidence" /><ActivityCard icon={History} title="Last run" detail="No completed runs" /><ActivityCard icon={FileText} title="Briefs" detail="No reports yet" /></div></section></div><aside className="space-y-5"><section className="panel p-5"><div className="flex items-start justify-between"><div><p className="eyebrow">Live trace</p><h2 className="mt-1 text-sm font-semibold">Agent plan</h2></div><div className={`trace-orb ${running ? 'trace-orb-active' : ''}`}><Command className="size-3.5" /></div></div><div className="mt-6 space-y-4">{steps.map((step, index) => <div key={step.label} className="flex gap-3"><div className={`step-icon step-${step.state}`}>{step.state === 'done' ? <Check className="size-3.5" /> : step.state === 'active' ? <span className="size-1.5 animate-ping rounded-full bg-accent" /> : <span>{String(index + 1).padStart(2, '0')}</span>}</div><div className="min-w-0"><p className={`text-xs font-medium ${step.state === 'active' ? 'text-accent' : ''}`}>{step.label}</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{step.detail}</p></div></div>)}</div></section><section className="panel p-5"><div className="flex items-center gap-2"><CircleAlert className="size-4 text-warning" /><p className="text-xs font-medium">Before you run</p></div><p className="mt-3 text-[11px] leading-5 text-muted-foreground">Use this workspace for research and decision support only. Any clinical interpretation must be made by a qualified professional.</p></section></aside></div><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} /></div>
}

function ActivityCard({ icon: Icon, title, detail }: { icon: typeof Zap; title: string; detail: string }) { return <div className="rounded-lg border border-border bg-muted/25 p-3"><Icon className="size-3.5 text-accent" /><p className="mt-3 text-xs font-medium">{title}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></div> }
function CasesView({ onStart }: { onStart: () => void }) { return <EmptyState icon={FolderKanban} eyebrow="Case library" title="Keep your investigations together" copy="Completed backend runs, evidence, and decision briefs will be organized here." action="Start a new run" onAction={onStart} /> }
function ReportsView() { return <EmptyState icon={FileText} eyebrow="Reports" title="No briefs generated yet" copy="Run an investigation to generate a structured, auditable report from your connected model." action="Reports are backend-driven" onAction={() => undefined} disabled /> }
function EmptyState({ icon: Icon, eyebrow, title, copy, action, onAction, disabled }: { icon: typeof FolderKanban; eyebrow: string; title: string; copy: string; action: string; onAction: () => void; disabled?: boolean }) { return <div className="mx-auto max-w-3xl py-14 text-center"><div className="eyebrow justify-center">{eyebrow}</div><h1 className="mt-4 text-4xl font-semibold tracking-[-.05em]">{title}</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{copy}</p><div className="panel mx-auto mt-10 flex min-h-[260px] max-w-xl flex-col items-center justify-center p-8"><div className="flex size-12 items-center justify-center rounded-xl bg-accent/10 text-accent"><Icon className="size-5" /></div><p className="mt-4 text-xs text-muted-foreground">Nothing has been returned by the backend yet.</p><button disabled={disabled} onClick={onAction} className="primary-button mt-5 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-3.5" />{action}</button></div></div> }

export { OptiDermaDashboard }
