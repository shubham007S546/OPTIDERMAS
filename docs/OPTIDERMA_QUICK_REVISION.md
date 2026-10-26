# OptiDerma — One-Page Quick Revision Sheet

**Target Use:** 5-minute quick revision before entering the viva / project presentation room.

---

## 1. Project At A Glance

- **Project Title:** OptiDerma: Multimodal Dermatology AI Decision-Support Platform
- **Problem Statement:** High clinical uncertainty in skin lesion assessment, shortage of dermatologists, high benign biopsy rates, and failure of black-box classifiers to provide explainable reasoning or clinical guidelines.
- **Main Objective:** Provide an objective, multimodal clinical decision-support system integrating computer vision, morphological explainability (XAI), guideline retrieval (RAG), and verified clinician referral.
- **Scope & Role:** Strictly clinical decision-support; not an autonomous diagnostic device.

---

## 2. One-Diagram System Architecture

```
[ User Browser / Clinician ]
             │
   HTTP / SSE / Multipart
             ▼
[ Next.js 15 App Router Frontend (Port 3000) ]
   ├── Dashboard & 3D Brain Viewer
   ├── Upload Zone & Pre-flight IQA
   ├── Diagnostic Results & Probability Bars
   ├── Lesion Canvas (Views A–H & Morphometrics)
   ├── 6-Segment Consultation Chat (Mode A & B)
   ├── History Drawer & Care Connect Directory
             │
   Reverse Proxy / Direct REST API
             ▼
[ FastAPI 0.115 Async Backend (Port 8000) ]
   ├── Security Headers & IP Rate Limiter
   ├── Image Quality Auditor (Blur, Glare, Resolution)
   ├── DullRazor Preprocessor (96 kernels, Telea Inpainting)
   ├── PyTorch EfficientNet-B4 + U-Net (17.7M params, checkpoint 006a77b02a)
   │     ├── 7-Class Classifier (akiec, bcc, bkl, df, mel, nv, vasc)
   │     ├── Grad-CAM Engine (f4 448ch, Spatial Energy Ratio)
   │     └── U-Net Segmentation & Morphometrics (Area, Asymmetry, Compactness)
   ├── Agentic AI Orchestrator (10 Typed Tools, 5 Dynamic Routes)
   ├── Dermatology RAG Engine (34 Guidelines, BM25 + Semantic Boosting)
   ├── Spoken Voice-Turn Pipeline (Whisper STT -> Agent -> ElevenLabs/gTTS)
   └── Dual-Tier Persistence Layer
         ├── Local SQLite (WAL Mode, zero-latency durability)
         └── Supabase Cloud PostgreSQL (PostgREST API sync)
```

---

## 3. Seven HAM10000 Diagnostic Classes

| Code | Clinical Condition | Category | Clinical Severity |
| :--- | :--- | :--- | :--- |
| **`mel`** | Cutaneous Melanoma | Malignant | High (requires urgent narrow-margin excisional biopsy) |
| **`bcc`** | Basal Cell Carcinoma | Malignant | High / Moderate (common non-melanoma epidermal tumor) |
| **`akiec`** | Actinic Keratosis / Intraepithelial Carcinoma | Malignant / Pre-cancer | Moderate (epidermal dysplasia; potential SCC precursor) |
| **`nv`** | Melanocytic Nevi (Common Moles) | Benign | Low (normal melanocytic proliferation) |
| **`bkl`** | Benign Keratosis-like Lesions | Benign | Low (seborrheic keratosis, solar lentigo) |
| **`df`** | Dermatofibroma | Benign | Low (benign fibrous histiocytic nodule) |
| **`vasc`** | Vascular Lesions | Benign | Low (angiomas, angiokeratomas, pyogenic granuloma) |

*Malignant Set:* `{"mel", "bcc", "akiec"}` | *Benign Set:* `{"nv", "bkl", "vasc", "df"}`

---

## 4. Key AI / ML & Computational Pipelines

1. **Pre-flight IQA:** Laplacian variance $>12.0$ (blur check), mean brightness $>25.0$, specular glare $<12\%$ of pixels.
2. **DullRazor Algorithm:** 96 directional morphological black-hat line kernels $\to$ dynamic skin texture threshold ($\mu + 0.9\sigma$) $\to$ connected component stroke filtering ($2A/P \le 9$) $\to$ Telea inpainting.
3. **Inference & Grad-CAM:** Forward pass through EfficientNet-B4 $\to$ analytical gradient $\frac{\partial y^c}{\partial f4}$ $\to$ global pooling weights $\to$ ReLU $\to$ bilinear upsampling to $256 \times 256$ $\to$ Spatial Energy Ratio calculation ($\text{Inside} / \text{Outside}$).
4. **Morphometrics:** Largest component segmentation $\to$ eigen-decomposition principal axis alignment $\to$ Asymmetry Index ($\text{XOR} / \text{Union}$) $\to$ Compactness ($P^2 / 4\pi A$).
5. **Dermatology RAG:** 34 peer-reviewed guidelines $\to$ tokenization & stop-word removal $\to$ Robertson-Spärck Jones BM25 score + semantic keyword overlap + condition code boost (+2.0) $\to$ Top-2 retrieval $\to$ 6-segment answer synthesis with `[CIT-X]` bracketed citations.

---

## 5. Technology Stack Summary

- **Frontend:** Next.js 15.2.4 (App Router), React 19, TypeScript, TailwindCSS, Lucide Icons, Three.js.
- **Backend:** Python 3.12, FastAPI 0.115, Uvicorn, Pydantic V2, Starlette.
- **Computer Vision & ML:** PyTorch 2.6, Torchvision, TIMM (EfficientNet-B4), OpenCV 4.10, NumPy, SciPy.
- **Explainability:** Grad-CAM autograd hook, DullRazor morphological filters.
- **Agentic AI & RAG:** Custom 10-tool stateful orchestrator, BM25, Groq API (`llama-3.3-70b-versatile` / `llama-3.1-8b-instant`), deterministic fallback engine.
- **Voice & Audio:** Whisper STT, ElevenLabs API, Google Text-to-Speech (`gTTS`).
- **Databases:** SQLite (WAL mode, `optiderma_persistence.db`), Supabase Cloud PostgreSQL.
- **Reporting:** ReportLab 4.4.3 (PDF compilation).

---

## 6. Key Verified API Endpoints

- `GET /health` $\to$ Operational heartbeat
- `GET /ready` $\to$ Validates PyTorch weights in memory
- `POST /predict` $\to$ Primary dermoscopy inference, DullRazor, Grad-CAM, and morphometrics
- `POST /analyze` $\to$ Multimodal inference with patient symptoms and RAG
- `GET /analysis/{id}/xai` $\to$ Recomputes Grad-CAM for arbitrary target class
- `POST /analysis/{id}/verify` $\to$ Independent deterministic audit check
- `POST /conversation` $\to$ Multi-turn agentic consultation turn
- `POST /agent/voice-turn` $\to$ Full multimodal spoken voice pipeline (audio in $\to$ MP3 out)
- `GET /dermatologists/search` $\to$ Verified clinic directory search
- `POST /care/appointment-request` $\to$ Clinician appointment referral booking

---

## 7. Verified Test Baseline

- **Pytest Backend Suite:** **67 / 67 Passed** (100% pass rate)
- **TypeScript Type Check:** **0 Errors** (`pnpm exec tsc --noEmit`)
- **Next.js Production Build:** **5 Static/Dynamic Routes Built** cleanly with Turbopack
- **Live Evidence Captured:** **9 Genuine Screenshots** in `docs/optiderma_presentation_evidence/`

---

## 8. Five Strongest Contributions

1. **True Multitask Synergistic Vision:** Both 7-class probability and pixel segmentation from a single EfficientNet-B4 backbone.
2. **Artifact-Resistant XAI:** 96-kernel directional DullRazor that protects lesion borders while eliminating hair artifacts.
3. **Quantitative Spatial Energy Metrics:** Grad-CAM is validated using mathematical spatial energy ratios ($\text{Inside} / \text{Outside}$) rather than visual guesswork.
4. **Zero-Hallucination Dermatology RAG:** Hybrid BM25 retrieval over 34 peer-reviewed clinical practice guidelines with deterministic fallback.
5. **Dual-Tier Resilient Persistence:** Local SQLite WAL plus Supabase Cloud PostgreSQL guarantees zero data loss and offline demonstration capability.

---

## 9. Top 10 Viva Answers (Cheat-Sheet)

1. **Why EfficientNet-B4?** Compound scaling balances depth, width, and resolution with 19M parameters, outperforming ResNet-50 on fine dermoscopy textures without heavy ViT FLOPs.
2. **Why 7 classes?** Direct mapping from the international benchmark HAM10000 dataset, distinguishing 3 malignant from 4 benign lesion types.
3. **Why uncalibrated softmax $\ne$ true probability?** Softmax reflects logit margin ratios and suffers from overconfidence; true probability requires calibration and prevalence adjustment.
4. **How does Grad-CAM work?** Computes gradients $\frac{\partial y^c}{\partial A^k}$ on the final 448-channel convolutional feature map, pools to weights, and creates a weighted ReLU sum upsampled to $256 \times 256$.
5. **What does DullRazor do?** Uses 96 directional morphological line kernels to isolate dark hair strands without eroding circular pigment globules, followed by Telea fast-marching inpainting.
6. **What is an AI Agent vs a Chatbot?** An agent has dynamic routing, state memory, and a registry of 10 typed executable tools that interact with real backend services and databases.
7. **How does RAG prevent hallucinations?** Strictly grounds answers in retrieved passages from 34 indexed medical guidelines, enforces `[CIT-X]` citation checks, and executes deterministic fallbacks.
8. **Why dual-store database?** SQLite WAL provides immediate local persistence and offline resilience; Supabase provides remote cloud synchronization.
9. **How does Care Connect protect patient ethics?** Queries verified tertiary hospitals (AIIMS, PGIMER, KEM); marks bookings as "Pending" requests and never fabricates doctor ratings or calendar slots.
10. **What is the primary limitation?** Dataset bias toward Fitzpatrick skin types I–III (fair skin); system requires formal multi-ethnic clinical validation before clinical adoption.
