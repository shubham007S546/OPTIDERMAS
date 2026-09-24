'use client'

import dynamic from 'next/dynamic'
import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, CalendarDays, Camera, Check, FileText, ImagePlus, Menu, MessageCircle, ShieldCheck, Sparkles, UploadCloud, X } from 'lucide-react'

const NeuralBrain = dynamic(() => import('@/components/neural-brain').then((module) => module.NeuralBrain), { ssr: false, loading: () => <div className="neural-placeholder" /> })
type View = 'home' | 'analyze' | 'consultation' | 'monitor' | 'model'

type Stage = 'idle' | 'quality' | 'analyzing' | 'complete' | 'unavailable'

export default function OptiDermaDashboard() {
  const [view, setView] = useState<View>('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [processing, setProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function normalizeImage(next: File) {
    if (typeof createImageBitmap === 'undefined') return next
    const bitmap = await createImageBitmap(next, { imageOrientation: 'from-image' })
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width; canvas.height = bitmap.height
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
    bitmap.close()
    return await new Promise<File>((resolve) => canvas.toBlob((blob) => resolve(blob ? new File([blob], next.name, { type: next.type }) : next), next.type, .94))
  }

  async function selectFile(next?: File) {
    if (!next?.type.startsWith('image/')) return
    const normalized = await normalizeImage(next)
    setFile(normalized); setPreview(URL.createObjectURL(normalized)); setStage('quality'); setView('analyze'); setMenuOpen(false)
  }

  async function analyze() {
    if (!file || processing) return
    setProcessing(true); setStage('analyzing')
    const body = new FormData(); body.append('file', file)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/predictions/analyze`, { method: 'POST', body })
      if (!response.ok) throw new Error('unavailable')
      setStage('complete')
    } catch { setStage('unavailable') }
    setProcessing(false)
  }

  function navigate(next: View) { setView(next); setMenuOpen(false) }

  return <main className="site-shell">
    <header className="site-nav">
      <button className="wordmark" onClick={() => navigate('home')} aria-label="OptiDerma home"><span className="wordmark-mark">O</span><span>OPTIDERMA</span></button>
      <nav className="desktop-links" aria-label="Main navigation"><button onClick={() => navigate('analyze')}>Analyze</button><button onClick={() => navigate('consultation')}>Consult</button><button onClick={() => navigate('monitor')}>Monitor</button><button onClick={() => navigate('model')}>Model</button></nav>
      <div className="nav-actions"><button className="nav-cta" onClick={() => navigate('consultation')}>Book a session <ArrowRight size={15} /></button><button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu"><Menu size={20} /></button></div>
    </header>
    <AnimatePresence>{menuOpen && <motion.nav className="mobile-menu" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>{[['home','Home'],['analyze','Check my skin'],['consultation','Talk to OptiDerma'],['monitor','Monitor'],['model','Model intelligence']].map(([key,label]) => <button key={key} onClick={() => navigate(key as View)}>{label}<ArrowRight size={15} /></button>)}</motion.nav>}</AnimatePresence>
    <AnimatePresence mode="wait"><motion.div key={view} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .32 }}>
      {view === 'home' && <Home navigate={navigate} choose={selectFile} />}
      {view === 'analyze' && <Analyze file={file} preview={preview} stage={stage} processing={processing} choose={() => inputRef.current?.click()} run={analyze} clear={() => { setFile(null); setPreview(null); setStage('idle') }} />}
      {view === 'consultation' && <Consultation navigate={navigate} />}
      {view === 'monitor' && <Monitor />}
      {view === 'model' && <Model />}
    </motion.div></AnimatePresence>
    <input ref={inputRef} className="sr-only" type="file" accept="image/*" onChange={(e) => selectFile(e.target.files?.[0])} />
  </main>
}

function Home({ navigate, choose }: { navigate: (view: View) => void; choose: (file?: File) => void }) { const input = useRef<HTMLInputElement>(null); return <>
  <section className="hero editorial-section"><div className="hero-copy"><p className="eyebrow">AI-assisted skin health</p><h1>Understand your skin.<br /><em>See what the AI sees.</em></h1><p className="hero-sub">Upload a clear image of a skin concern and explore visual analysis, model evidence, and an intelligent consultation experience.</p><div className="hero-actions"><button className="button-primary" onClick={() => input.current?.click()}>Check my skin <ArrowRight size={17} /></button><button className="button-quiet" onClick={() => navigate('consultation')}>Talk to OptiDerma</button></div><p className="safety"><ShieldCheck size={15} /> AI decision support · Not a clinical diagnosis</p></div><div className="hero-engine"><div className="engine-orbit orbit-one" /><div className="engine-orbit orbit-two" /><NeuralBrain state="idle" className="hero-brain" /><div className="engine-readout"><span className="status-dot" /> Vision engine online <b>01</b></div><div className="engine-callout"><Sparkles size={15} /><span>Explainable AI<br /><b>evidence, not guesses</b></span></div></div></section>
  <input ref={input} className="sr-only" type="file" accept="image/*" onChange={(e) => choose(e.target.files?.[0])} />
  <section className="upload-section editorial-section"><div><p className="eyebrow">01 / Check your skin</p><h2>Start with what<br /><em>you can see.</em></h2><p className="section-copy">Add a clear image of the area you are concerned about. The image is orientation-corrected before analysis.</p><button className="text-link" onClick={() => input.current?.click()}>Upload an image <ArrowRight size={16} /></button></div><button className="upload-surface" onClick={() => input.current?.click()}><span className="upload-plus">+</span><strong>Add a photo</strong><span>Upload or use your camera</span><small>JPG, PNG, WEBP · up to 20 MB</small></button></section>
  <section className="steps-section editorial-section"><div className="section-topline"><p className="eyebrow">02 / From photo to understanding</p><p>One calm path from concern to next step.</p></div><div className="steps-row">{[['01','Photo','Add a clear image.'],['02','Analysis','The trained model examines it.'],['03','Explanation','Explore what the model sees.'],['04','Consultation','Ask OptiDerma what you want to know.']].map(([n,t,d]) => <div className="step" key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></div>)}</div></section>
  <section className="evidence-section editorial-section"><div className="evidence-copy"><p className="eyebrow">03 / See what the AI sees</p><h2>Evidence before<br /><em>assumptions.</em></h2><p className="section-copy">Keep the original image, segmentation, and model attention together. Every output should be traceable to the connected backend.</p><button className="text-link" onClick={() => navigate('analyze')}>Explore analysis <ArrowRight size={16} /></button></div><div className="evidence-visual"><div className="evidence-placeholder"><NeuralBrain state="idle" className="evidence-brain" /><span>LIVE EVIDENCE CANVAS</span><b>Upload an image to populate this view</b></div></div></section>
  <section className="consult-cta editorial-section"><div><p className="eyebrow">04 / Talk to OptiDerma</p><h2>Have a question<br /><em>about what you notice?</em></h2></div><button className="button-primary" onClick={() => navigate('consultation')}>Book a session <ArrowRight size={17} /></button></section>
  <footer><span className="wordmark"><span className="wordmark-mark">O</span><span>OPTIDERMA</span></span><span>Private by design</span><span>Decision support, not diagnosis</span></footer>
</> }

function Analyze({ file, preview, stage, processing, choose, run, clear }: { file: File | null; preview: string | null; stage: Stage; processing: boolean; choose: () => void; run: () => void; clear: () => void }) { return <section className="app-view editorial-section"><div className="view-heading"><p className="eyebrow">Check your skin</p><h1>See what the AI sees.</h1><p>Upload a clear image to begin. Orientation is corrected automatically. Disease markings appear only when returned by the connected inference service.</p></div><div className="analysis-workspace"><div className="analysis-image"><div className="workspace-label">IMAGE EVIDENCE <span>{stage === 'complete' ? 'ANNOTATED' : 'READY'}</span></div>{preview ? <div className={`uploaded-image ${processing ? 'is-scanning' : ''}`}><img src={preview} alt="Uploaded skin concern, orientation corrected" />{processing && <span className="scan-line" aria-hidden="true" />}{stage === 'complete' && <span className="annotation-status"><Check size={13} /> Backend annotation returned</span>}{stage === 'unavailable' && <span className="annotation-status muted">Analysis service unavailable</span>}<button onClick={clear} aria-label="Remove uploaded image"><X size={16} /></button></div> : <button className="upload-surface large" onClick={choose}><ImagePlus size={26} /><strong>Add a photo</strong><span>Upload or use camera</span></button>}{file && <button className="button-primary run-button" onClick={run} disabled={processing}>{processing ? 'Analyzing…' : 'Run analysis'} <ArrowRight size={16} /></button>}</div><div className="analysis-brain-panel"><div className="workspace-label">EXPLAINABILITY <span>{processing ? 'PROCESSING' : 'VISUAL METAPHOR'}</span></div><NeuralBrain state={processing ? 'active' : 'idle'} className="analysis-brain" /><p>{processing ? 'The model is evaluating the uploaded image.' : 'A visual metaphor for the model\'s connected reasoning — not a diagnostic output.'}</p></div></div></section> }

function Consultation({ navigate }: { navigate: (view: View) => void }) { return <section className="app-view editorial-section"><div className="view-heading"><p className="eyebrow">Talk to OptiDerma</p><h1>A calmer way to ask.</h1><p>Book a guided AI consultation to discuss a concern, understand an analysis, or plan a follow-up.</p></div><div className="consultation-grid"><div className="consult-visual"><NeuralBrain state="idle" className="consult-brain" /><div className="voice-core"><MessageCircle size={19} /><span>Ready to listen</span></div></div><div className="consult-copy"><p className="eyebrow">Choose your session</p>{[['Quick AI check','Start with an image and a focused question.'],['Guided consultation','Explore context, evidence, and next steps together.'],['Follow-up','Compare what you notice over time.']].map(([title,detail]) => <button className="session-option" key={title}><span><b>{title}</b><small>{detail}</small></span><ArrowRight size={17} /></button>)}<button className="button-primary" onClick={() => navigate('analyze')}>Begin with an image <Camera size={16} /></button></div></div></section> }

function Monitor() { return <section className="app-view editorial-section"><div className="view-heading"><p className="eyebrow">Monitor your skin</p><h1>Keep track of<br /><em>what you notice.</em></h1><p>Build a visual timeline with baseline, follow-up, and latest images. Comparison is context, not proof of progression.</p></div><div className="monitor-line"><div><span>BASELINE</span><strong>Start with your first image</strong><small>Visual comparison</small></div><div><span>FOLLOW-UP</span><strong>Add another observation</strong><small>Notes and dates</small></div><div><span>LATEST</span><strong>Your timeline will appear here</strong><small>Private workspace</small></div></div></section> }

function Model() { return <section className="app-view editorial-section"><div className="view-heading"><p className="eyebrow">Model intelligence</p><h1>The technical layer,<br /><em>made inspectable.</em></h1><p>OptiDerma's research surface keeps architecture, performance, and explainability separate from the consumer experience.</p></div><div className="model-grid"><div><span>TOP-3 DIFFERENTIAL ACCURACY</span><strong>98.30%</strong></div><div><span>MACRO ROC-AUC</span><strong>96.21%</strong></div><div><span>BOUNDARY LOCALIZATION</span><strong>92.88%</strong></div><div><span>BINARY SCREENING ROC-AUC</span><strong>92.71%</strong></div></div><div className="model-note"><FileText size={18} /><p>Outputs shown here describe model evaluation, not a patient diagnosis. Connect the inference service to populate live predictions, segmentation masks, Grad-CAM, and report exports.</p></div></section> }
