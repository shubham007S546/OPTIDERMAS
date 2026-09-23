'use client'

import { useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
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
  MoreHorizontal,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
  X,
} from 'lucide-react'

const navItems = [
  { label: 'Overview', icon: Activity, active: true },
  { label: 'Analysis workspace', icon: ScanSearch },
  { label: 'History', icon: History },
  { label: 'Reports', icon: FileText },
]

const workflow = [
  { label: 'Image upload', detail: 'Awaiting image', icon: UploadCloud },
  { label: 'Quality gate', detail: 'Not started', icon: ShieldCheck },
  { label: 'Model inference', detail: 'Model unavailable', icon: FlaskConical },
  { label: 'Decision support', detail: 'Not started', icon: Layers3 },
]

export function OptiDermaDashboard() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [activeNav, setActiveNav] = useState('Overview')

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function clearFile() {
    setFileName(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <main className="min-h-screen bg-[#f5f7f9] text-[#17212b]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[250px] shrink-0 border-r border-[#dce3e8] bg-[#fbfcfd] px-4 py-5 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#0f6d78] text-white shadow-sm">
              <Microscope className="size-[19px]" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.02em]">OptiDerma</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#78909a]">Research suite</p>
            </div>
          </div>

          <div className="mt-10 space-y-1">
            <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#91a0aa]">Workspace</p>
            {navItems.map((item) => {
              const Icon = item.icon
              const selected = activeNav === item.label
              return (
                <button
                  key={item.label}
                  onClick={() => setActiveNav(item.label)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition ${selected ? 'bg-[#e7f1f2] font-semibold text-[#0c6974]' : 'text-[#667783] hover:bg-[#f0f4f6]'}`}
                >
                  <Icon className="size-[17px]" strokeWidth={1.8} />
                  {item.label}
                  {selected && <ChevronRight className="ml-auto size-3.5" />}
                </button>
              )
            })}
          </div>

          <div className="mt-auto rounded-xl border border-[#dce5e8] bg-white p-3.5">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 size-4 shrink-0 text-[#0f7782]" />
              <div>
                <p className="text-xs font-semibold text-[#31434e]">Investigational tool</p>
                <p className="mt-1 text-[11px] leading-[1.55] text-[#788894]">For research use only. Not a substitute for clinical examination.</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex h-[72px] items-center justify-between border-b border-[#dce3e8] bg-white/80 px-5 backdrop-blur sm:px-8">
            <div className="flex items-center gap-3">
              <button className="rounded-md p-1.5 text-[#7a8b96] hover:bg-[#f2f5f6] lg:hidden" aria-label="Open navigation"><Menu className="size-5" /></button>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-[#8b9aa4]">{activeNav}</p>
                <h1 className="mt-0.5 text-[20px] font-semibold tracking-[-0.03em] text-[#1d2b35]">Analysis overview</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="hidden items-center gap-2 rounded-lg border border-[#dce4e8] px-3 py-2 text-xs font-medium text-[#60727e] sm:flex"><CircleHelp className="size-3.5" /> Guide</button>
              <div className="flex size-8 items-center justify-center rounded-full bg-[#d9ecee] text-xs font-semibold text-[#176b75]">DR</div>
            </div>
          </header>

          <div className="mx-auto max-w-[1380px] px-5 py-7 sm:px-8 lg:px-10">
            <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm text-[#70818c]">Good morning, Dr. Rivera</p>
                <h2 className="mt-1 text-[28px] font-semibold tracking-[-0.045em] text-[#172630]">Ready for a new analysis?</h2>
              </div>
              <button onClick={() => inputRef.current?.click()} className="flex w-fit items-center gap-2 rounded-lg bg-[#0f6d78] px-4 py-2.5 text-xs font-semibold text-white shadow-[0_3px_10px_rgba(15,109,120,0.18)] transition hover:bg-[#0b5b64]"><ImagePlus className="size-4" /> Analyze an image <ArrowUpRight className="size-3.5" /></button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Analyses this session" value="—" note="No completed analyses" icon={ScanSearch} />
              <StatCard label="Model status" value="Offline" note="Connect a model to begin" icon={FlaskConical} tone="amber" />
              <StatCard label="Quality gate" value="Ready" note="Configured · threshold 100" icon={ShieldCheck} tone="green" />
              <StatCard label="Audit trail" value="Empty" note="Results will appear here" icon={History} />
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <section className="rounded-xl border border-[#dce4e8] bg-white p-5 shadow-[0_2px_10px_rgba(31,52,65,0.025)] sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-[16px] font-semibold text-[#23343e]">Start an analysis</h3><p className="mt-1 text-xs text-[#82919a]">Upload a dermoscopic image for the quality gate.</p></div>
                  <button className="rounded-md p-1.5 text-[#9aa8b0] hover:bg-[#f3f6f7]" aria-label="More options"><MoreHorizontal className="size-5" /></button>
                </div>
                <button onClick={() => inputRef.current?.click()} className="mt-5 flex min-h-[235px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-[#b9cbd0] bg-[#f8fbfb] px-5 text-center transition hover:border-[#0f7a84] hover:bg-[#f1f8f8]">
                  {previewUrl ? <img src={previewUrl} alt="Selected lesion preview" className="max-h-[190px] rounded-md object-contain" /> : <><div className="flex size-12 items-center justify-center rounded-full bg-[#e4f1f2] text-[#0f7782]"><UploadCloud className="size-6" strokeWidth={1.7} /></div><p className="mt-4 text-sm font-semibold text-[#38515c]">Drop an image here or browse</p><p className="mt-1.5 text-xs text-[#8a9aa3]">JPG, PNG, or WEBP · maximum 20 MB</p></>}
                </button>
                <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} className="sr-only" />
                {fileName && <div className="mt-3 flex items-center justify-between rounded-lg border border-[#dce7e8] bg-[#f8fbfb] px-3 py-2 text-xs"><span className="truncate text-[#49616d]">{fileName}</span><button onClick={clearFile} aria-label="Remove image" className="ml-3 text-[#8b9ca5] hover:text-[#c04d4d]"><X className="size-4" /></button></div>}
                <div className="mt-5 flex items-center justify-between border-t border-[#edf0f2] pt-4"><p className="flex items-center gap-1.5 text-[11px] text-[#8998a1]"><ShieldCheck className="size-3.5 text-[#71949a]" /> Your image stays in this workspace</p><button disabled={!fileName} className="rounded-lg bg-[#d9e6e8] px-4 py-2 text-xs font-semibold text-[#779097] disabled:cursor-not-allowed">Run quality gate</button></div>
              </section>

              <section className="rounded-xl border border-[#dce4e8] bg-white p-5 shadow-[0_2px_10px_rgba(31,52,65,0.025)] sm:p-6">
                <div className="flex items-center justify-between"><div><h3 className="text-[16px] font-semibold text-[#23343e]">Analysis pipeline</h3><p className="mt-1 text-xs text-[#82919a]">Evidence-first workflow</p></div><SlidersHorizontal className="size-4 text-[#91a0a8]" /></div>
                <div className="mt-6 space-y-1">
                  {workflow.map((step, index) => { const Icon = step.icon; return <div key={step.label} className="relative flex gap-3 py-3"><div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#dbe5e7] bg-[#f8fbfb] text-[#87a0a6]"><Icon className="size-4" strokeWidth={1.7} /></div>{index < workflow.length - 1 && <div className="absolute left-[15px] top-[43px] h-[27px] border-l border-dashed border-[#ccdadd]" />}<div className="min-w-0"><p className="text-xs font-semibold text-[#526773]">{step.label}</p><p className="mt-1 text-[11px] text-[#97a4ab]">{step.detail}</p></div></div> })}
                </div>
                <div className="mt-5 rounded-lg bg-[#fff9ed] px-3.5 py-3"><div className="flex gap-2.5"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#bd8b2d]" /><p className="text-[11px] leading-[1.55] text-[#8d6d32]">Inference is disabled until a trusted trained model is configured by the server.</p></div></div>
              </section>
            </div>

            <section className="mt-5 rounded-xl border border-[#dce4e8] bg-white p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div><h3 className="text-[16px] font-semibold text-[#23343e]">Latest results</h3><p className="mt-1 text-xs text-[#82919a]">Model outputs and reports will be recorded here.</p></div><button className="flex w-fit items-center gap-1 text-xs font-semibold text-[#0d727c]">View history <ChevronRight className="size-3.5" /></button></div>
              <div className="mt-5 flex min-h-[112px] items-center justify-center rounded-lg border border-dashed border-[#e0e7e9] bg-[#fbfcfc]"><div className="text-center"><CheckCircle2 className="mx-auto size-5 text-[#aabcc0]" strokeWidth={1.6} /><p className="mt-2 text-xs font-medium text-[#82929b]">No analysis results yet</p><p className="mt-1 text-[11px] text-[#aab0b4]">Upload an image to create your first audit record.</p></div></div>
            </section>

            <p className="mt-7 text-center text-[10px] leading-relaxed text-[#9aa6ad]">OptiDerma is an investigational AI decision-support system and is not a substitute for examination by a qualified healthcare professional or histopathological diagnosis.</p>
          </div>
        </section>
      </div>
    </main>
  )
}

function StatCard({ label, value, note, icon: Icon, tone = 'default' }: { label: string; value: string; note: string; icon: typeof Activity; tone?: 'default' | 'amber' | 'green' }) {
  const iconClass = tone === 'amber' ? 'bg-[#fff5de] text-[#b9872b]' : tone === 'green' ? 'bg-[#e7f3ee] text-[#40866d]' : 'bg-[#e8f1f3] text-[#397b83]'
  return <div className="rounded-xl border border-[#dce4e8] bg-white p-4 shadow-[0_2px_10px_rgba(31,52,65,0.02)]"><div className="flex items-start justify-between"><p className="text-[11px] font-medium text-[#7e8e98]">{label}</p><div className={`flex size-7 items-center justify-center rounded-lg ${iconClass}`}><Icon className="size-3.5" /></div></div><p className="mt-4 text-[22px] font-semibold tracking-[-0.04em] text-[#253842]">{value}</p><p className="mt-1 text-[11px] text-[#9aa7ae]">{note}</p></div>
}

export default OptiDermaDashboard
