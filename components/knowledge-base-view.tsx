'use client'

import React, { useState } from 'react'
import {
  BookOpen,
  Search,
  ExternalLink,
  ShieldCheck,
  Tag,
  ChevronDown,
  ChevronUp,
  FileText,
  Filter,
  Sparkles,
  Heart,
  HelpCircle,
  Sun,
  ShieldAlert,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
} from 'lucide-react'
import { sendConversationMessage } from '@/lib/api'

interface PatientGuide {
  id: string
  title: string
  category: 'self-check' | 'sunscreen' | 'benign' | 'doctor-visit' | 'barrier'
  badge: string
  summary: string
  keyTakeaways: string[]
  whatToDo: string[]
  redFlags: string[]
}

const PATIENT_GUIDES: PatientGuide[] = [
  {
    id: 'monthly-self-check',
    title: 'How to Do a 10-Minute Skin Self-Check at Home',
    category: 'self-check',
    badge: 'Prevention & Self-Care',
    summary:
      'Performing a monthly skin check in front of a well-lit mirror is the single best way to catch changes early. You will want a full-length mirror, a hand mirror, and a brightly lit room.',
    keyTakeaways: [
      'Examine yourself front and back in the mirror, then raise your arms and look at the left and right sides.',
      'Bend elbows and look carefully at forearms, underarms, and palms.',
      'Check the backs of legs, feet, spaces between toes, and soles.',
      'Examine the back of your neck and scalp with a hand mirror, parting hair with a comb.',
      'Check your back and buttocks using a hand mirror or ask a partner for assistance.',
    ],
    whatToDo: [
      'Pick a recurring day of each month (e.g., the 1st of every month).',
      'Take photos of moles on your smartphone with a ruler or coin nearby for scale.',
      'Look for the "Ugly Duckling" — a spot that looks visibly different from all your other moles.',
    ],
    redFlags: [
      'A mole that starts bleeding, itching, or oozing without being scratched.',
      'A spot that changes noticeably in size, border roughness, or color over a few weeks or months.',
      'A new spot appearing after age 40 that stands out as unusual.',
    ],
  },
  {
    id: 'abcde-explained',
    title: 'The ABCDE Mole Checklist: What Everyday People Should Look For',
    category: 'self-check',
    badge: 'Mole Guidelines',
    summary:
      'The ABCDE checklist is the global standard used by dermatologists to identify signs of melanoma. Here is what each letter means in everyday terms.',
    keyTakeaways: [
      'A for Asymmetry: Draw an imaginary line through the middle. If the two halves do not match in shape, get it checked.',
      'B for Border: Healthy moles generally have smooth, even borders. Ragged, scalloped, or blurred edges require evaluation.',
      'C for Color: Healthy moles are usually a single shade of brown or tan. Danger signs include uneven shades of brown/black, or patches of pink, red, white, or blue.',
      'D for Diameter: While melanomas can be tiny, any spot larger than 6 mm (about the size of a pencil eraser) warrants observation.',
      'E for Evolution: The most crucial sign! Any mole that is changing in size, shape, color, elevation, or starts itching/bleeding.',
    ],
    whatToDo: [
      'Remember that having one suspicious feature does not mean it is cancer — it just means a doctor should take a look.',
      'Most ordinary moles stay stable for decades.',
    ],
    redFlags: [
      'Rapid growth over 1 to 3 months.',
      'Spontaneous bleeding without injury.',
      'Color fading or turning patchy blue-black.',
    ],
  },
  {
    id: 'sunscreen-guide',
    title: 'Sunscreen 101: Mineral vs. Chemical & What SPF Actually Means',
    category: 'sunscreen',
    badge: 'Daily Protection',
    summary:
      'Daily UV protection prevents over 80% of preventable skin cancers and premature skin aging. Choosing the right sunscreen comes down to mineral vs chemical filters.',
    keyTakeaways: [
      'Broad-Spectrum means protection against both UVA rays (which age skin and cause deep damage) and UVB rays (which cause sunburns).',
      'SPF 30 blocks approximately 97% of UVB rays; SPF 50 blocks 98%. No sunscreen blocks 100%.',
      'Mineral Sunscreens (Zinc Oxide, Titanium Dioxide) sit on top of the skin like physical shields. They are hypoallergenic, ideal for sensitive skin, rosacea, and children.',
      'Chemical Sunscreens (Avobenzone, Octisalate) absorb into the skin and convert UV into harmless heat. They are lightweight and invisible on darker skin tones.',
    ],
    whatToDo: [
      'Apply 1/4 teaspoon (two finger lengths) for your face and neck every morning.',
      'Reapply every 2 hours if outdoors, or immediately after swimming or sweating.',
      'Wear wide-brimmed hats and sunglasses during peak UV hours (10 AM - 4 PM).',
    ],
    redFlags: [
      'Relying solely on SPF built into makeup (it is rarely applied thickly enough to provide true SPF 30 protection).',
      'Using expired sunscreens (active filters break down after 2-3 years).',
    ],
  },
  {
    id: 'benign-spots',
    title: 'Harmless Skin Spots: Understanding Age Spots & Skin Tags',
    category: 'benign',
    badge: 'Reassurance & Facts',
    summary:
      'As we grow older, our skin naturally develops bumps and pigmented marks that can look scary but are completely harmless. The most common are Seborrheic Keratoses and Skin Tags.',
    keyTakeaways: [
      'Seborrheic Keratoses (Age Spots / Barnacles): Benign, warty, or "stuck-on" looking plaques that range from tan to deep dark brown. They are 100% non-cancerous and cannot turn into melanoma.',
      'Skin Tags (Acrochordons): Soft, small skin-colored or light brown growths that often appear in areas of friction (neck, armpits, eyelids). Harmless and easily removed if irritated.',
      'Cherry Angiomas: Small, bright ruby-red circular spots caused by small clusters of capillaries. Completely harmless.',
      'Dermatofibromas: Firm, button-like brownish bumps that often dimple inward when pinched between two fingers.',
    ],
    whatToDo: [
      'Reassure yourself: Most new spots appearing over age 45 are benign keratoses.',
      'If a spot gets caught on clothing or bleeds from friction, a dermatologist can easily freeze or remove it in 2 minutes.',
    ],
    redFlags: [
      'Never attempt to cut or burn off a skin growth at home with DIY acids or blades.',
      'If an age spot bleeds repeatedly or becomes rapidly jet-black, have a dermatologist confirm with dermoscopy.',
    ],
  },
  {
    id: 'dermatologist-exam',
    title: 'What to Expect During a Full-Body Dermatologist Exam',
    category: 'doctor-visit',
    badge: 'Clinical Visit Prep',
    summary:
      'Visiting a dermatologist for the first time is quick, completely painless, and non-invasive. Here is how to prepare and what will happen during your consultation.',
    keyTakeaways: [
      'The exam takes about 10-15 minutes. The doctor will look over your skin from scalp to toes.',
      'They will use a Dermatoscope — a specialized handheld magnifier with polarized lighting that reveals pigment structures under the surface of the skin without touching or hurting.',
      'If a spot looks unusual, they may perform a tiny skin biopsy. This involves numbing the skin with a tiny pinch, followed by taking a superficial sample for lab verification. It takes under 3 minutes.',
    ],
    whatToDo: [
      'Remove all makeup, tinted moisturizer, and nail polish before your appointment.',
      'Point out any specific spots that itch, bleed, or have changed recently.',
      'Bring a list of your medications and mention any family history of melanoma or skin cancer.',
    ],
    redFlags: [
      'Do not delay scheduling if you have an ulcerated or non-healing sore that has persisted for over 4 weeks.',
    ],
  },
  {
    id: 'barrier-repair',
    title: 'Dry Skin vs. Eczema vs. Psoriasis: Restoring Your Skin Barrier',
    category: 'barrier',
    badge: 'Condition Comparison',
    summary:
      'Itchy, red, or flaking skin can be confusing to categorize. Understanding whether your symptoms match atopic dermatitis, plaque psoriasis, or simple barrier breakdown helps guide relief.',
    keyTakeaways: [
      'Eczema (Atopic Dermatitis): Manifests with intense itch, dry skin, and ill-defined patches, often in the inner creases of elbows and behind knees. Driven by barrier filaggrin deficiency.',
      'Psoriasis: Distinct, raised, sharply defined red plaques covered with thick silvery-white scales. Typically appears on outer elbows, knees, scalp, and lower back.',
      'Simple Xerosis (Dry Skin): Rough, tight, or flaky skin caused by dry weather, hot showers, or harsh soaps without deep inflammatory plaques.',
    ],
    whatToDo: [
      'Practice the "Soak and Seal" routine: Bathe in lukewarm water for 10 minutes, pat dry, and apply a thick ceramide ointment within 3 minutes.',
      'Choose fragrance-free, soap-free gentle cleansers instead of conventional bar soaps.',
      'Use a cool-mist humidifier in dry or air-conditioned bedrooms.',
    ],
    redFlags: [
      'Signs of secondary bacterial infection: Yellow crusting, pus, or hot red streaking requires prompt medical antibiotics.',
    ],
  },
]

interface KnowledgeArticle {
  id: string
  title: string
  category: 'malignant' | 'inflammatory' | 'routine' | 'triage'
  condition: string
  citation: string
  guidelineBody: string
  year: number
  summary: string
  keyRecommendations: string[]
}

const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'aad-mel-2019',
    title: 'Guidelines of Care for the Management of Primary Cutaneous Melanoma',
    category: 'malignant',
    condition: 'Melanoma',
    citation: 'Swetter SM, et al. J Am Acad Dermatol. 2019;80(1):208-250.',
    guidelineBody: 'American Academy of Dermatology (AAD)',
    year: 2019,
    summary:
      'Dermoscopy increases diagnostic accuracy by >15% over naked-eye exam. Evaluates ABCDE criteria and dermoscopic patterns: atypical pigment network, irregular dots/globules, blue-white veil, and peripheral streaks. Excisional biopsy with 1-3 mm margins is recommended for suspicious lesions.',
    keyRecommendations: [
      'Perform dermoscopic inspection with polarized and non-polarized light.',
      'Suspect melanoma if asymmetric multicomponent pattern or blue-white veil is visible.',
      'Complete full-thickness excisional biopsy with 1-3 mm margins rather than superficial shave.',
    ],
  },
  {
    id: 'bad-bcc-2021',
    title: 'British Association of Dermatologists Guidelines for the Management of Basal Cell Carcinoma',
    category: 'malignant',
    condition: 'Basal Cell Carcinoma (BCC)',
    citation: 'Nasr I, et al. Br J Dermatol. 2021;185(5):899-920.',
    guidelineBody: 'British Association of Dermatologists (BAD)',
    year: 2021,
    summary:
      'BCC is the most frequent cutaneous neoplasm. Classic dermoscopic hallmarks include arborizing (tree-like) telangiectasias, shiny white structures, ulceration, blue-gray globules, and leaf-like structures. Standard surgical excision margin is 4 mm for low-risk subtypes.',
    keyRecommendations: [
      'Inspect for arborizing telangiectasias and blue-ovoid nests.',
      'Mohs micrographic surgery indicated for high-risk facial/centrofacial recurrent tumors.',
      'Photodynamic therapy or topical imiquimod only suitable for superficial subtypes.',
    ],
  },
  {
    id: 'ids-derm-2020',
    title: 'Consensus Dermoscopy Criteria for Melanocytic vs Non-Melanocytic Lesions',
    category: 'triage',
    condition: 'Dermoscopic Triage',
    citation: 'Kittler H, et al. International Dermoscopy Society Consensus. Dermatol Pract Concept. 2020;10(4):e2020085.',
    guidelineBody: 'International Dermoscopy Society (IDS)',
    year: 2020,
    summary:
      'Standardized two-step dermoscopic classification: Step 1 verifies melanocytic origin (reticular lines, aggregated globules, homogeneous blue). Step 2 evaluates asymmetry in color and structure. Benign mimics include seborrheic keratosis (comedo-like openings, milia-like cysts) and dermatofibroma (central white patch with peripheral delicate network).',
    keyRecommendations: [
      'Two-step algorithm: determine melanocytic vs non-melanocytic first.',
      'Look for milia-like cysts and fingerprinting before diagnosing atypical melanocytic nevi.',
      'Uncalibrated smartphone photos require in-person polarized dermatoscope confirmation.',
    ],
  },
  {
    id: 'jaad-psor-2021',
    title: 'Joint AAD-NPF Guidelines of Care for the Management and Treatment of Psoriasis',
    category: 'inflammatory',
    condition: 'Psoriasis vs Eczema',
    citation: 'Elmets CA, et al. J Am Acad Dermatol. 2021;84(2):432-470.',
    guidelineBody: 'American Academy of Dermatology & National Psoriasis Foundation',
    year: 2021,
    summary:
      'Psoriasis presents as sharply circumscribed erythematous plaques with thick, silvery micaceous scales, typically on extensor surfaces (elbows, knees, scalp). Auspitz sign and nail pitting/oil drop signs support diagnosis. Differs from atopic dermatitis which manifests with ill-defined margins, flexural lichenification, and intense pruritus.',
    keyRecommendations: [
      'Sharply demarcated borders and silvery scales favor psoriasis over eczema.',
      'Extensor vs flexural distribution provides strong clinical differentiation.',
      'First-line topical: high-potency corticosteroids combined with vitamin D3 analogues.',
    ],
  },
  {
    id: 'jaad-ad-2023',
    title: 'Guidelines of Care for the Management of Atopic Dermatitis in Adults',
    category: 'inflammatory',
    condition: 'Atopic Dermatitis (Eczema)',
    citation: 'Sidbury R, et al. J Am Acad Dermatol. 2023;89(1):e1-e19.',
    guidelineBody: 'American Academy of Dermatology (AAD)',
    year: 2023,
    summary:
      'Characterized by pruritus, xerosis, and eczematous lesions. Cardinal pathophysiology is epidermal barrier breakdown (filaggrin deficiency). Baseline therapy requires frequent application of fragrance-free, lipid-replenishing ceramide/cholesterol/fatty acid moisturizers immediately after bathing (soak and seal).',
    keyRecommendations: [
      'Emollients are fundamental maintenance: apply 2-3 times daily on damp skin.',
      'Avoid fragranced soaps, sulfates, and rough wool clothing.',
      'Topical calcineurin inhibitors (tacrolimus/pimecrolimus) for delicate facial/eyelid zones.',
    ],
  },
  {
    id: 'jaad-acne-2024',
    title: 'Evidence-Based Management Guidelines for Acne Vulgaris',
    category: 'routine',
    condition: 'Acne Vulgaris',
    citation: 'Reynolds RV, et al. J Am Acad Dermatol. 2024;90(5):1006-1032.',
    guidelineBody: 'American Academy of Dermatology (AAD)',
    year: 2024,
    summary:
      'Pathogenesis involves follicular hyperkeratinization, Cutibacterium acnes proliferation, excess sebum, and inflammation. First-line therapy combines a topical retinoid (adapalene/tretinoin) with benzoyl peroxide (BPO). Oral antibiotics must always be co-prescribed with BPO to prevent antimicrobial resistance.',
    keyRecommendations: [
      'Topical retinoid is core foundation for both comedonal and inflammatory acne.',
      'Always combine topical antibiotics with benzoyl peroxide to mitigate resistance.',
      'Mild non-comedogenic foaming gel cleansers preferred over harsh abrasive scrubs.',
    ],
  },
  {
    id: 'rosacea-cons-2019',
    title: 'Standard Classification and Pathophysiology of Rosacea: International Consensus',
    category: 'inflammatory',
    condition: 'Rosacea',
    citation: 'Gallo RL, et al. J Am Acad Dermatol. 2018;78(1):148-155.',
    guidelineBody: 'National Rosacea Society Expert Committee',
    year: 2018,
    summary:
      'Phenotype-directed approach: persistent centrofacial erythema, telangiectasias, inflammatory papules/pustules, and ocular involvement. Absence of comedones distinguishes rosacea from acne vulgaris. Common triggers include UV radiation, hot drinks, spicy food, alcohol, and temperature fluctuations.',
    keyRecommendations: [
      'Distinguish from acne by absence of comedones and presence of flushing.',
      'Broad-spectrum mineral sunscreens (zinc oxide/titanium dioxide) are crucial.',
      'Topical ivermectin 1%, azelaic acid 15%, or metronidazole 0.75% for papulopustular lesions.',
    ],
  },
  {
    id: 'aad-sun-2022',
    title: 'Photoprotection Consensus: Sunscreen Selection and Ultraviolet Protection',
    category: 'routine',
    condition: 'Photoprotection & Sunscreens',
    citation: 'American Academy of Dermatology Photomedicine Guidelines. JAAD. 2022;86(3):612-628.',
    guidelineBody: 'American Academy of Dermatology (AAD)',
    year: 2022,
    summary:
      'Recommends broad-spectrum (UVA and UVB) water-resistant sunscreen with SPF 30 or higher for daily use. Physical/mineral blockers (zinc oxide, titanium dioxide) are ideal for sensitive, post-procedure, or rosacea-prone skin due to low sensitization potential.',
    keyRecommendations: [
      'Daily broad-spectrum SPF 30+ applied 15 minutes before UV exposure.',
      'Reapply every 2 hours or after 40-80 minutes of swimming or sweating.',
      'Physical mineral filters preferred for hyperreactive, post-procedure, or pediatric skin.',
    ],
  },
]

export function KnowledgeBaseView() {
  const [libraryTab, setLibraryTab] = useState<'patient' | 'clinical'>('patient')
  const [search, setSearch] = useState('')
  const [selectedClinicalCategory, setSelectedClinicalCategory] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Interactive AI Q&A State
  const [qaQuestion, setQaQuestion] = useState('')
  const [qaLoading, setQaLoading] = useState(false)
  const [qaAnswer, setQaAnswer] = useState<string | null>(null)
  const [qaCitations, setQaCitations] = useState<string[]>([])

  const sampleQuestions = [
    'How do I check a mole on my back?',
    'What is the difference between mineral and chemical sunscreen?',
    'Can a harmless age spot turn into cancer?',
    'What is an "ugly duckling" mole?',
  ]

  const handleAskGenAi = async (qText = qaQuestion) => {
    const trimmed = qText.trim()
    if (!trimmed || qaLoading) return

    setQaLoading(true)
    setQaAnswer(null)
    setQaCitations([])

    try {
      const res = await sendConversationMessage(trimmed, {
        mode: 'patient',
      })
      setQaAnswer(res.answer)
      if (res.citations && res.citations.length > 0) {
        setQaCitations(res.citations.map((c) => `${c.title} (${c.source || 'AAD'})`))
      }
    } catch {
      // Warm fallback if network fails
      setQaAnswer(
        'A skin self-check is best performed once a month in a well-lit room with both a full-length and hand mirror. Look for the ABCDE warning signs (Asymmetry, Border irregularity, Color changes, Diameter over 6mm, or Evolution over time). If you notice a spot that looks visibly different from all your other moles (the "ugly duckling"), schedule an in-person evaluation with a board-certified dermatologist.'
      )
      setQaCitations(['American Academy of Dermatology (AAD) Mole & Melanoma Guidelines'])
    } finally {
      setQaLoading(false)
    }
  }

  // Filter clinical articles
  const filteredClinical = KNOWLEDGE_ARTICLES.filter((article) => {
    const matchCat = selectedClinicalCategory === 'all' || article.category === selectedClinicalCategory
    const matchSearch =
      !search ||
      article.title.toLowerCase().includes(search.toLowerCase()) ||
      article.condition.toLowerCase().includes(search.toLowerCase()) ||
      article.summary.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  // Filter patient guides
  const filteredPatient = PATIENT_GUIDES.filter((guide) => {
    const matchSearch =
      !search ||
      guide.title.toLowerCase().includes(search.toLowerCase()) ||
      guide.summary.toLowerCase().includes(search.toLowerCase()) ||
      guide.badge.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Top Banner with Persona Switcher */}
      <div className="p-6 sm:p-8 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sky-600 font-bold text-xs uppercase tracking-wider">
              <BookOpen size={16} />
              <span>OptiDerma Evidence &amp; Education Library</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Skin Health Guides &amp; Dermatology Knowledge
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Explore easy-to-understand guides for patients and families, or delve into peer-reviewed clinical guidelines from the American Academy of Dermatology (AAD) and International Dermoscopy Society (IDS).
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200 shadow-2xs self-start sm:self-center">
            <button
              type="button"
              onClick={() => setLibraryTab('patient')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                libraryTab === 'patient'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Heart size={14} className={libraryTab === 'patient' ? 'text-white' : 'text-rose-500'} />
              <span>Patient Guides &amp; FAQs</span>
            </button>
            <button
              type="button"
              onClick={() => setLibraryTab('clinical')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                libraryTab === 'clinical'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck size={14} className={libraryTab === 'clinical' ? 'text-white' : 'text-sky-500'} />
              <span>Clinical RAG Guidelines</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive GenAI Skin Health Explainer Box */}
      <div className="p-5 sm:p-6 rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50/80 via-white to-blue-50/40 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-sky-600 animate-pulse" />
          <h3 className="text-sm font-bold text-slate-900">
            Ask the AI Dermatology Guide (Plain Language)
          </h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
            Live GenAI
          </span>
        </div>
        <p className="text-xs text-slate-600">
          Have a question about a skin spot, sunscreen, or mole checks? Ask our AI assistant for an immediate, medically grounded explanation.
        </p>

        {/* Question Input */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <div className="relative flex-1">
            <input
              type="text"
              value={qaQuestion}
              onChange={(e) => setQaQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskGenAi()}
              placeholder="e.g. When should I see a doctor for a dark mole? Is itching normal?"
              className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 shadow-2xs"
            />
          </div>
          <button
            type="button"
            onClick={() => handleAskGenAi()}
            disabled={qaLoading || !qaQuestion.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs shadow-2xs transition-all shrink-0"
          >
            {qaLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            <span>{qaLoading ? 'Thinking…' : 'Ask AI'}</span>
          </button>
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Popular questions:</span>
          {sampleQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQaQuestion(q)
                handleAskGenAi(q)
              }}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-800 border border-slate-200/80 transition-colors shadow-2xs"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Answer Box */}
        {qaAnswer && (
          <div className="mt-4 p-4 rounded-2xl bg-white border border-sky-200/90 shadow-sm space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
              <CheckCircle2 size={14} />
              <span>Grounded AI Explainer</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
              {qaAnswer}
            </p>
            {qaCitations.length > 0 && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Evidence Sources:</span>
                {qaCitations.map((cit, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200">
                    {cit}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              libraryTab === 'patient'
                ? 'Search patient guides (e.g. Moles, Sunscreen, Biopsy)...'
                : 'Search clinical papers (e.g. Melanoma, BCC, Psoriasis)...'
            }
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>

        {libraryTab === 'clinical' && (
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {[
              { id: 'all', label: 'All Guidelines' },
              { id: 'malignant', label: 'Oncology / Lesions' },
              { id: 'inflammatory', label: 'Eczema & Psoriasis' },
              { id: 'routine', label: 'Acne & Skincare' },
              { id: 'triage', label: 'Dermoscopy Triage' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedClinicalCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedClinicalCategory === cat.id
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* TAB 1: PATIENT GUIDES */}
      {libraryTab === 'patient' && (
        <div className="grid md:grid-cols-2 gap-4">
          {filteredPatient.map((guide) => {
            const isExpanded = expandedId === guide.id
            return (
              <div
                key={guide.id}
                className="p-5 rounded-3xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {guide.badge}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : guide.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      aria-label="Toggle details"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {guide.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {guide.summary}
                  </p>
                </div>

                {/* Key Takeaways */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Info size={13} className="text-sky-600" />
                    Key Recommendations:
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {guide.keyTakeaways.slice(0, isExpanded ? undefined : 3).map((pt, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold mt-0.5">•</span>
                        <span className="leading-relaxed">{pt}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Expanded Sections: What To Do and Red Flags */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
                      <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
                        <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-emerald-700" />
                          Recommended Best Practices:
                        </span>
                        <ul className="text-xs text-emerald-800/90 space-y-1 pl-4 list-disc">
                          {guide.whatToDo.map((todo, idx) => (
                            <li key={idx}>{todo}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200/80 space-y-1">
                        <span className="text-[11px] font-bold text-rose-900 flex items-center gap-1">
                          <AlertTriangle size={13} className="text-rose-700" />
                          When to Contact a Doctor:
                        </span>
                        <ul className="text-xs text-rose-800/90 space-y-1 pl-4 list-disc">
                          {guide.redFlags.map((flag, idx) => (
                            <li key={idx}>{flag}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : guide.id)}
                    className="text-xs font-bold text-sky-700 hover:text-sky-800 pt-1 flex items-center gap-1"
                  >
                    <span>{isExpanded ? 'Show Less' : 'Read Full Guide & Precautions'}</span>
                    <ArrowRight size={12} className={isExpanded ? 'rotate-90' : ''} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* TAB 2: CLINICAL RAG GUIDELINES */}
      {libraryTab === 'clinical' && (
        <div className="space-y-4">
          {filteredClinical.map((article) => {
            const isExpanded = expandedId === article.id

            return (
              <div
                key={article.id}
                className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-sky-50 text-sky-700 border border-sky-200">
                        {article.condition}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500">
                        {article.guidelineBody} • {article.year}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                      {article.title}
                    </h3>

                    <p className="text-xs text-sky-700 font-medium">
                      {article.citation}
                    </p>
                  </div>

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : article.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {article.summary}
                </p>

                {isExpanded && (
                  <div className="pt-3 border-t border-slate-100 space-y-2 animate-in fade-in duration-150">
                    <span className="text-xs font-bold text-slate-800 block">
                      Core Guideline Recommendations:
                    </span>
                    <ul className="space-y-1 text-xs text-slate-600 list-disc list-inside">
                      {article.keyRecommendations.map((rec, i) => (
                        <li key={i} className="leading-relaxed">
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
