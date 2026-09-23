'use client'

import { useRef, useState } from 'react'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  FileText,
  FlaskConical,
  History,
  ImagePlus,
  Info,
  Layers3,
  Menu,
  Microscope,
  Play,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react'

const navItems = [
  { label: 'Overview', icon: Activity },
  { label: 'Analysis workspace', icon: ScanSearch },
  { label: 'History', icon: History },
  { label: 'Reports', icon: FileText },
]

const workflow = [
  { label: 'Image upload', detail: 'Add a dermoscopic image', icon: UploadCloud },
  { label: 'Quality gate', detail: 'Check image suitability', icon: ShieldCheck },
  { label: 'Model inference', detail: 'Review model signals', icon: FlaskConical },
  { label: 'Decision support', detail: 'Generate an evidence report', icon: Layers3 },
]

export function OptiDermaDashboard() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [activeNav, setActiveNav] = useState('Overview')
  const [showApp, setShowApp] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setPreviewUrl(URL.createObjectURL(file))
    setShowApp(true)
    setActiveNav('Analysis workspace')
  }

  function clearFile() {
    setFileName(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function runAnalysis() {
    if (!fileName) return
    setIsRunning(true)
    window.setTimeout(() => setIsRunning(false), 1800)
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f9fc] text-[#17243b]">
      {!showApp ? (
        <Landing onStart={() => { setShowApp(true); setActiveNav('Overview') }} onUpload={() => inputRef.current?.click()} />
      ) : (
        <AppShell activeNav={activeNav} setActiveNav={setActiveNav} onBack={() => setShowApp(false)}>
          {activeNav === 'Overview' && <Overview onStart={() => setActiveNav('Analysis workspace')} />}
          {activeNav === 'Analysis workspace' && <Workspace inputRef={inputRef} fileName={fileName} previewUrl={previewUrl} onFileChange={onFileChange} onClear={clearFile} onRun={runAnalysis} isRunning={isRunning} />}
          {activeNav === 'History' && <HistoryView />}
          {activeNav === 'Reports' && <ReportsView />}
        </AppShell>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} className="sr-only" />
    </main>
  )
}

function Landing({ onStart, onUpload }: { onStart: () => void; onUpload: () => void }) {
  return <div className="relative min-h-screen">
    <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_80%_10%,rgba(109,91,230,0.14),transparent_32%),radial-gradient(circle_at_10%_50%,rgba(53,183,178,0.1),transparent_28%)]" />
    <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
      <Brand />
      <nav className="hidden items-center gap-8 text-sm text-[#718099] md:flex"><a href="#workflow">How it works</a><a href="#principles">Principles</a><a href="#about">About</a></nav>
      <button onClick={onStart} className="rounded-full border border-[#d8deec] bg-white px-4 py-2 text-sm font-semibold text-[#394664] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">Open workspace</button>
    </header>
    <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 pt-12 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-28 lg:pt-20">
      <div className="animate-rise"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d8d4ff] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#6657c9]"><Sparkles className="size-3.5" /> Evidence-first dermatology research</div><h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.07em] text-[#16213a] sm:text-7xl">See the signal.<br /><span className="text-[#6759d5]">Understand the skin.</span></h1><p className="mt-7 max-w-xl text-lg leading-8 text-[#6e7b93]">OptiDerma brings image quality, model outputs, and clinical context into one calm, auditable workspace for dermatology teams.</p><div className="mt-9 flex flex-wrap gap-3"><button onClick={onStart} className="group flex items-center gap-3 rounded-full bg-[#5e51ce] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(94,81,206,0.25)] transition hover:-translate-y-1 hover:bg-[#5144bc]">Enter the workspace <ArrowRight className="size-4 transition group-hover:translate-x-1" /></button><button onClick={onUpload} className="flex items-center gap-2 rounded-full border border-[#dbe0ec] bg-white px-5 py-3.5 text-sm font-semibold text-[#52617d] transition hover:-translate-y-1 hover:border-[#bcb7ed]"><Play className="size-3.5 fill-current" /> Try an image</button></div><div className="mt-12 flex items-center gap-8 text-xs text-[#8490a5]"><span className="flex items-center gap-2"><Check className="size-4 text-[#41a996]" /> Private by design</span><span className="flex items-center gap-2"><Check className="size-4 text-[#41a996]" /> Built for research</span></div></div>
      <div className="animate-float relative mx-auto w-full max-w-[520px]"><div className="absolute -inset-8 rounded-[3rem] bg-[#d9d4ff]/30 blur-3xl" /><div className="relative rounded-[2rem] border border-white/90 bg-white/85 p-3 shadow-[0_25px_80px_rgba(58,64,112,0.16)] backdrop-blur"><div className="rounded-[1.4rem] bg-[#f3f5fb] p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="size-2 rounded-full bg-[#5e51ce]" /><span className="text-xs font-semibold text-[#36415c]">Live analysis preview</span></div><span className="text-[10px] text-[#8c96a9]">01 / 04</span></div><div className="mt-5 grid gap-3 sm:grid-cols-[1.1fr_.9fr]"><div className="relative flex min-h-[270px] items-end overflow-hidden rounded-2xl bg-[linear-gradient(145deg,#2e1e36,#9c5864_45%,#e4a36e)] p-4"><div className="absolute left-[27%] top-[18%] size-32 rounded-[48%] bg-[#bc6c73] opacity-60 blur-xl" /><div className="absolute left-[33%] top-[28%] size-24 rounded-full border-[10px] border-[#d99187]/60 blur-[1px]" /><div className="absolute right-4 top-4 rounded-full bg-black/20 px-2 py-1 text-[9px] text-white">Dermoscopic image</div><div className="relative rounded-lg bg-black/35 px-2.5 py-1.5 text-[10px] text-white">Quality score <b>96%</b></div></div><div className="space-y-3"><MiniSignal label="Image quality" value="Excellent" color="teal" /><MiniSignal label="Pattern family" value="Reticular" color="violet" /><MiniSignal label="Confidence" value="0.87" color="blue" /><div className="rounded-xl bg-white p-3"><div className="flex items-center gap-2 text-[10px] font-semibold text-[#68748b]"><ShieldCheck className="size-3.5 text-[#41a996]" /> Audit ready</div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#edf0f6]"><div className="h-full w-[87%] rounded-full bg-[#6759d5]" /></div></div></div></div></div></div></div>
    </section>
    <section id="workflow" className="relative z-10 border-y border-[#e8eaf2] bg-white/60"><div className="mx-auto grid max-w-7xl gap-4 px-6 py-8 sm:grid-cols-3 lg:px-10"><Feature number="01" title="Prepare" copy="A quality gate catches unusable images before they enter your analysis." /><Feature number="02" title="Explore" copy="See model signals with the context and uncertainty they deserve." /><Feature number="03" title="Document" copy="Turn every analysis into a clear, reviewable audit trail." /></div></section>
  </div>
}

function AppShell({ activeNav, setActiveNav, onBack, children }: { activeNav: string; setActiveNav: (value: string) => void; onBack: () => void; children: React.ReactNode }) {
  return <div className="flex min-h-screen"><aside className="hidden w-[255px] shrink-0 border-r border-[#e3e6ef] bg-white/70 px-4 py-6 lg:flex lg:flex-col"><button onClick={onBack} className="mb-12 px-3 text-left"><Brand /></button><p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9aa3b7]">Workspace</p><div className="space-y-1">{navItems.map(({ label, icon: Icon }) => <button key={label} onClick={() => setActiveNav(label)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${activeNav === label ? 'bg-[#efedff] font-semibold text-[#5e51ce]' : 'text-[#718099] hover:bg-[#f5f6fa]'}`}><Icon className="size-[17px]" />{label}{activeNav === label && <ChevronRight className="ml-auto size-3.5" />}</button>)}</div><div className="mt-auto rounded-2xl bg-[#f5f4ff] p-4"><Info className="size-4 text-[#6759d5]" /><p className="mt-3 text-xs font-semibold text-[#4d467f]">Investigational tool</p><p className="mt-1 text-[11px] leading-5 text-[#8584a3]">For research use only. Not a substitute for clinical examination.</p></div></aside><section className="min-w-0 flex-1"><header className="flex h-[76px] items-center justify-between border-b border-[#e3e6ef] bg-white/75 px-5 backdrop-blur sm:px-8"><div className="flex items-center gap-3"><button className="lg:hidden" aria-label="Open navigation"><Menu className="size-5 text-[#718099]" /></button><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9aa3b7]">OptiDerma / {activeNav}</p><h1 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#24304a]">{activeNav === 'Overview' ? 'Your research overview' : activeNav}</h1></div></div><div className="flex items-center gap-3"><button className="hidden items-center gap-2 rounded-full border border-[#e1e4ed] px-3 py-2 text-xs font-medium text-[#718099] sm:flex"><CircleHelp className="size-3.5" /> Guide</button><div className="flex size-9 items-center justify-center rounded-full bg-[#e5e1ff] text-xs font-bold text-[#5e51ce]">DR</div></div></header><div className="mx-auto max-w-[1380px] px-5 py-8 sm:px-8 lg:px-10">{children}</div></section></div>
}

function Overview({ onStart }: { onStart: () => void }) { return <div className="animate-rise"><div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-[#8490a5]">Good morning, Dr. Rivera</p><h2 className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-[#1b2740]">Ready for a new analysis?</h2></div><button onClick={onStart} className="flex w-fit items-center gap-2 rounded-full bg-[#5e51ce] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#5e51ce]/15 transition hover:-translate-y-0.5"><ImagePlus className="size-4" /> Analyze an image <ArrowUpRight className="size-3.5" /></button></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Analyses this session" value="0" note="Start your first analysis" icon={ScanSearch} /><StatCard label="Quality gate" value="Ready" note="Threshold configured" icon={ShieldCheck} tone="green" /><StatCard label="Research library" value="12" note="Saved reference cases" icon={History} /><StatCard label="Audit trail" value="Empty" note="Results appear here" icon={FileText} /></div><div className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_.7fr]"><section className="rounded-3xl border border-[#e3e6ef] bg-white p-6 shadow-[0_12px_35px_rgba(51,59,95,0.04)]"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-[#2b3752]">Your workflow</h3><p className="mt-1 text-xs text-[#8994a8]">A clear path from image to insight.</p></div><Sparkles className="size-5 text-[#6759d5]" /></div><div className="mt-7 grid gap-3 sm:grid-cols-4">{workflow.map((item, index) => <div key={item.label} className="group rounded-2xl border border-[#edf0f5] bg-[#fafbfe] p-4 transition hover:-translate-y-1 hover:border-[#d9d4ff] hover:bg-[#f7f5ff]"><div className="flex items-center justify-between"><div className="flex size-9 items-center justify-center rounded-xl bg-[#efedff] text-[#6759d5]"><item.icon className="size-4" /></div><span className="text-[10px] font-bold text-[#b0b7c7]">0{index + 1}</span></div><p className="mt-5 text-xs font-semibold text-[#44516b]">{item.label}</p><p className="mt-1 text-[11px] leading-5 text-[#96a0b2]">{item.detail}</p></div>)}</div></section><section className="rounded-3xl bg-[#25294a] p-6 text-white"><div className="flex items-center gap-2 text-[#c7c3ff]"><Microscope className="size-4" /><span className="text-xs font-semibold">Research note</span></div><p className="mt-8 text-2xl font-semibold leading-tight tracking-[-0.04em]">The best signal starts with the best image.</p><p className="mt-4 text-sm leading-6 text-[#b2b7d0]">OptiDerma makes quality visible before interpretation begins, so every result starts from trustworthy evidence.</p><button onClick={onStart} className="mt-8 flex items-center gap-2 text-xs font-semibold text-[#d6d2ff]">Start with a quality check <ArrowRight className="size-3.5" /></button></section></div></div> }

function Workspace({ inputRef, fileName, previewUrl, onFileChange, onClear, onRun, isRunning }: { inputRef: React.RefObject<HTMLInputElement | null>; fileName: string | null; previewUrl: string | null; onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void; onRun: () => void; isRunning: boolean }) { return <div className="animate-rise"><div className="mb-8"><p className="text-sm text-[#8490a5]">Step 1 of 4 · Evidence preparation</p><h2 className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-[#1b2740]">Start an analysis</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#7d899f]">Upload a dermoscopic image and we’ll check whether it is ready for reliable downstream review.</p></div><div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><section className="rounded-3xl border border-[#e3e6ef] bg-white p-6 shadow-[0_12px_35px_rgba(51,59,95,0.04)]"><div className="flex items-start justify-between"><div><h3 className="font-semibold text-[#2b3752]">Image quality gate</h3><p className="mt-1 text-xs text-[#8994a8]">JPG, PNG, or WEBP · maximum 20 MB</p></div><div className="rounded-full bg-[#e8f7f3] px-3 py-1 text-[10px] font-bold text-[#389983]">Secure upload</div></div><button onClick={() => inputRef.current?.click()} className="mt-6 flex min-h-[300px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[#c7cbe0] bg-[#fafbfe] px-5 text-center transition hover:border-[#8378e1] hover:bg-[#f8f7ff]">{previewUrl ? <img src={previewUrl} alt="Selected lesion preview" className="max-h-[260px] rounded-xl object-contain" /> : <><div className="flex size-14 items-center justify-center rounded-2xl bg-[#efedff] text-[#6759d5]"><UploadCloud className="size-7" /></div><p className="mt-5 text-sm font-semibold text-[#46536e]">Drop an image here or browse</p><p className="mt-2 text-xs text-[#98a2b4]">Your image stays in this workspace</p></>}</button>{fileName && <div className="mt-3 flex items-center justify-between rounded-xl border border-[#e3e6ef] bg-[#fafbfe] px-4 py-3 text-xs"><span className="truncate text-[#53617b]">{fileName}</span><button onClick={onClear} aria-label="Remove image" className="text-[#9aa3b7] hover:text-[#d05b6a]"><X className="size-4" /></button></div>}<div className="mt-5 flex items-center justify-between border-t border-[#edf0f5] pt-5"><span className="flex items-center gap-2 text-xs text-[#8994a8]"><ShieldCheck className="size-4 text-[#41a996]" /> Quality checks run locally</span><button onClick={onRun} disabled={!fileName || isRunning} className="rounded-full bg-[#5e51ce] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#5144bc] disabled:bg-[#dfe1ed] disabled:text-[#9ba2b5]">{isRunning ? 'Checking image…' : 'Run quality gate'}</button></div></section><Pipeline /></div></div> }

function Pipeline() { return <section className="rounded-3xl border border-[#e3e6ef] bg-white p-6"><h3 className="font-semibold text-[#2b3752]">Analysis pipeline</h3><p className="mt-1 text-xs text-[#8994a8]">Evidence-first workflow</p><div className="mt-7 space-y-2">{workflow.map((step, index) => <div key={step.label} className="relative flex gap-4 py-3"><div className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#e5e7f0] bg-[#fafbfe] text-[#9ba3b5]"><step.icon className="size-4" /></div>{index < workflow.length - 1 && <div className="absolute left-5 top-[52px] h-6 border-l border-dashed border-[#d5d8e4]" />}<div><p className="text-xs font-semibold text-[#53617b]">{step.label}</p><p className="mt-1 text-[11px] text-[#9aa3b7]">{step.detail}</p></div></div>)}</div></section> }

function HistoryView() { return <div className="animate-rise"><div className="mb-8"><p className="text-sm text-[#8490a5]">Your research library</p><h2 className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-[#1b2740]">Analysis history</h2></div><div className="rounded-3xl border border-[#e3e6ef] bg-white p-10 text-center"><div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#efedff] text-[#6759d5]"><History className="size-6" /></div><h3 className="mt-5 font-semibold text-[#43506a]">No saved analyses yet</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#8994a8]">Completed quality checks and reports will appear here, with a full audit trail for every case.</p><button className="mt-6 rounded-full bg-[#5e51ce] px-5 py-2.5 text-xs font-semibold text-white">Create your first analysis</button></div></div> }
function ReportsView() { return <div className="animate-rise"><div className="mb-8"><p className="text-sm text-[#8490a5]">Evidence you can revisit</p><h2 className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-[#1b2740]">Reports & documentation</h2></div><div className="grid gap-4 md:grid-cols-3"><ReportCard title="Quality report" copy="Image suitability and capture conditions" /><ReportCard title="Model summary" copy="Signals, confidence, and limitations" /><ReportCard title="Audit record" copy="Timestamped events and review notes" /></div></div> }
function ReportCard({ title, copy }: { title: string; copy: string }) { return <div className="rounded-3xl border border-[#e3e6ef] bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg"><div className="flex size-10 items-center justify-center rounded-xl bg-[#efedff] text-[#6759d5]"><FileText className="size-4" /></div><h3 className="mt-6 text-sm font-semibold text-[#3d4a66]">{title}</h3><p className="mt-2 text-xs leading-5 text-[#8994a8]">{copy}</p><button className="mt-6 flex items-center gap-1 text-xs font-semibold text-[#6759d5]">Learn more <ArrowRight className="size-3.5" /></button></div> }
function Brand() { return <div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-[#5e51ce] text-white shadow-lg shadow-[#5e51ce]/20"><Microscope className="size-[18px]" /></div><div><p className="text-[15px] font-bold tracking-[-0.03em] text-[#26304a]">OptiDerma</p><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#9aa3b7]">Research suite</p></div></div> }
function MiniSignal({ label, value, color }: { label: string; value: string; color: string }) { return <div className="rounded-xl bg-white p-3"><p className="text-[10px] text-[#8c96a9]">{label}</p><p className={`mt-1 text-xs font-bold ${color === 'teal' ? 'text-[#389983]' : color === 'violet' ? 'text-[#6759d5]' : 'text-[#4d78c7]'}`}>{value}</p></div> }
function Feature({ number, title, copy }: { number: string; title: string; copy: string }) { return <div className="flex gap-4 px-2"><span className="text-xs font-bold text-[#6759d5]">{number}</span><div><h3 className="text-sm font-semibold text-[#3e4962]">{title}</h3><p className="mt-1 text-xs leading-5 text-[#8994a8]">{copy}</p></div></div> }
function StatCard({ label, value, note, icon: Icon, tone = 'default' }: { label: string; value: string; note: string; icon: typeof Activity; tone?: 'default' | 'green' }) { return <div className="rounded-2xl border border-[#e3e6ef] bg-white p-4 shadow-[0_8px_25px_rgba(51,59,95,0.025)]"><div className="flex items-start justify-between"><p className="text-[11px] font-medium text-[#8994a8]">{label}</p><div className={`flex size-8 items-center justify-center rounded-xl ${tone === 'green' ? 'bg-[#e8f7f3] text-[#389983]' : 'bg-[#efedff] text-[#6759d5]'}`}><Icon className="size-4" /></div></div><p className="mt-5 text-2xl font-semibold tracking-[-0.05em] text-[#2b3752]">{value}</p><p className="mt-1 text-[11px] text-[#a0a8b8]">{note}</p></div> }

export default OptiDermaDashboard
