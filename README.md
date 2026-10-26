# OptiDerma — AI Decision-Support Web Application

> **IMPORTANT DISCLAIMER**: OptiDerma is an investigational research prototype and AI decision-support platform for dermoscopic image evaluation. **It is NOT a medical device, nor a diagnostic tool.** It is trained specifically on dermoscopy images; ordinary smartphone photographs can produce unreliable outputs. Any skin lesion that bleeds, grows, changes colour or shape, itches, or hurts requires immediate evaluation by a qualified medical professional or dermatologist.

---

## Architecture & Features

1. **Server-Side Preprocessing & Original Bytes**
   - The client application **never** resizes, crops, compresses, or re-encodes user images. The exact raw bytes selected via drag-and-drop, file picker, or device camera are streamed directly to the inference backend.
2. **Robust Inference Client**
   - Typed client with runtime schema validation via `zod`.
   - 60-second AbortController timeout.
   - 5-second automatic model wake-up notice.
   - Automatic single retry on network failure.
   - Clear contextual error handlers for 400 (unreadable image), 413 (exceeds 20 MB limit), 5xx server errors, and network disconnects.
3. **Clinical Results & Explainability**
   - Top-3 differential predictions with plain-language dermatological labels and calibrated probability bars.
   - Risk classification card referencing backend risk levels and recommendations, using "higher-concern group" language instead of diagnostic malignancy claims.
   - Morphological measurements with standard units (area in mm², perimeter in mm, coverage in %, asymmetry index, compactness).
   - Dynamic canvas contour rendering (scaled from 256×256 segmentation space) or direct toggle between original, segmentation mask, and CAM attention overlays when returned by the backend.
   - Model uncertainty warning banner when top prediction confidence is below 60%.
4. **Private by Design**
   - Zero client-side storage: no `localStorage`, `sessionStorage`, or IndexedDB.
   - Zero telemetry tracking or image logging (third-party analytics removed).
   - In-memory object URLs are immediately revoked upon clearing or switching images.
   - Mandatory research consent required prior to image transmission.
5. **ElevenLabs Conversational Voice Assistant Integration**
   - Integrates directly with the configured **OptiDerma Voice** agent (`agent_6601m418gdvxe7zr1zksvnmtb3f1`).
   - Built on official `@elevenlabs/react` SDK (`useConversation` + `ConversationProvider`).
   - Flexible connection strategy: connects using server-signed URLs (`/api/voice-session`) when server credentials are set, or directly using public `agentId` (`NEXT_PUBLIC_ELEVENLABS_AGENT_ID`) in public browser sessions.
   - Passes strictly **text-only** contextual summaries (`analysis_summary` dynamic variable) containing top predictions, risk level, and metrics. Raw image bytes are **never** passed to the voice model.
   - Handles microphone permissions gracefully with accessible user notices. Never exposes `ELEVENLABS_API_KEY` to the browser.
   - Real-time conversation status indicators (Disconnected, Connecting, Connected, Listening, Speaking, Muted).

---

## Environment Variables

Copy the template to create your local environment file:

```bash
cp .env.example .env.local
```

Configure the following variables in `.env.local`:

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Optional | `http://localhost:8000` | Base URL of the skin lesion inference backend |
| `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` | For Voice | `agent_6601m418gdvxe7zr1zksvnmtb3f1` | Public ElevenLabs agent ID for client connection |
| `ELEVENLABS_API_KEY` | Optional | - | Server-only ElevenLabs API key (never exposed to client) |
| `ELEVENLABS_AGENT_ID` | Optional | `agent_6601m418gdvxe7zr1zksvnmtb3f1` | Server ElevenLabs agent identifier |
| `NEXT_PUBLIC_SUPABASE_URL` | For Database | `https://uwlatkypjzfnobrobzns.supabase.co` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For Database | `sb_publishable_...` | Supabase publishable anon key |

---

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Run the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Start the Model Backend (real EfficientNet-B4 multi-task model)

The weights live in `model/optiderma_best_model.pth`. In a second terminal:

```bash
cd model
python -m venv .venv && .venv\Scripts\activate    # first time only
pip install -r requirements.txt                   # first time only
cd ..
pnpm api          # uvicorn on http://127.0.0.1:8000
pnpm api:test     # optional: contract smoke test against the running API
```

If the image-quality audit rejects an upload, the UI shows the backend's advice and an **Analyse anyway** button (sends `?force=true`).

### 4. Verify Code Quality & Automated Test Suites

OptiDerma includes an automated test matrix with 85+ passing assertions:

```bash
# 1. Strict TypeScript typechecking (Zero errors)
pnpm exec tsc --noEmit

# 2. Next.js production build (Turbopack static + dynamic route compilation)
pnpm build

# 3. Unified API Gateway contract & endpoints test
model\.venv\Scripts\python.exe scratch/test_unified_api.py

# 4. Multi-agent clinical workflow, RAG & Care Connect integration
model\.venv\Scripts\python.exe scratch/test_integrated_system.py

# 5. RAG evidence quality & 13-corpus citation integrity
model\.venv\Scripts\python.exe scratch/test_rag_evidence_quality.py

# 6. DullRazor hair removal preprocessor validation
model\.venv\Scripts\python.exe scratch/test_dullrazor.py

# 7. Live HTTP inference, XAI target-switching & process restart durability
model\.venv\Scripts\python.exe scratch/test_live_server_and_restart.py

# 8. OWASP security headers, payload limits (20MB) & latency benchmarks
model\.venv\Scripts\python.exe -m unittest backend/tests/benchmark_test.py

# 9. Multimodal reasoning & safety emergency triage unit tests
model\.venv\Scripts\python.exe -m unittest backend/tests/test_backend.py
```

---

## Unified Backend API & Endpoints

The unified FastAPI backend (`http://127.0.0.1:8000`) exposes:

| Route | Method | Purpose |
| :--- | :--- | :--- |
| `/health` | `GET` | Container liveness check |
| `/ready` | `GET` | Verifies PyTorch checkpoint readiness and memory status |
| `/predict` | `POST` | Core multimodal inference (classification + U-Net + Grad-CAM + morphometrics) |
| `/analyze` | `POST` | Multi-agent orchestrated clinical analysis |
| `/analysis/{id}` | `GET` | Retrieve canonical analysis record from durable store |
| `/analysis/{id}/verify` | `POST` | Re-run or inspect deterministic verification audit |
| `/analysis/{id}/report` | `GET` | Retrieve Patient (`?report_type=patient`) or Technical (`?report_type=technical`) JSON summary |
| `/analysis/{id}/report/pdf` | `GET` | Download publication-quality binary PDF report embedding 4 visual plates |
| `/analysis/{id}/xai` | `GET` | Target-class Grad-CAM heatmap generation (`?target_class=bcc\|mel\|compare`) |
| `/analysis/{id}/consultation-summary` | `POST` | Create structured pre-consultation visit packet for dermatologist |
| `/conversation` | `POST` | 8-node controlled agentic chat turn with verified RAG citations |
| `/dermatologists/search` | `GET` | Search verified tertiary hospital dermatology departments by PIN code / city |
| `/appointments/request` | `POST` | Save appointment request (persists with status `Pending`) |
| `/appointments/requests` | `GET` | List appointment requests and verification status |
| `/persistence/status` | `GET` | Probes Supabase Cloud and local SQLite durable store status |

---

## Persistence Architecture & Cloud Migration

1. **Local Durable Store (Authoritative in Current Release)**:
   - Analyses, XAI vectors, verification audits, multi-turn conversations, and appointment requests are durably persisted to an SQLite 3 database (`backend/data/optiderma_persistence.db`) running in Write-Ahead Logging (`WAL`) mode.
   - Verified to survive complete backend process termination and restarts.
2. **Supabase Cloud Migration**:
   - The Supabase remote endpoint (`https://uwlatkypjzfnobrobzns.supabase.co`) is actively reachable.
   - The client key in `.env.local` is a publishable anon key (`sb_publishable_...`), which lacks DDL permissions to create tables over PostgREST.
   - To instantiate cloud PostgreSQL tables, run [`docs/supabase_schema.sql`](docs/supabase_schema.sql) in the Supabase Dashboard SQL Editor.
   - Until tables are created in Supabase, `PersistenceService` dynamically reports `status: "pending_migration"` and writes safely to the local durable SQLite database.

---

## Research Demonstration Workflow

1. **System Health Check**: Visit `http://localhost:3000/console` to inspect real-time neural model status, XAI suite status, RAG index status, and durable persistence mode.
2. **General Skin Health Consultation**: Open Dermatology Chat and ask general clinical questions (e.g., *"What is the difference between eczema and psoriasis?"*). Confirm that the 8-node agent returns structured clinical overviews with verified `[CIT-X]` citations from indexed guidelines (AAD, BAD, IDS).
3. **Emergency Red-Flag Testing**: Submit critical symptom queries (*"I have a rapidly spreading dark rash with high fever and severe breathing difficulty"*). Verify that the system immediately prepends an explicit `URGENT MEDICAL WARNING` directing the user to 112 / 911 emergency care.
4. **Lesion Image Inference**: Upload `model/test_lesion.jpg` in Analysis Workspace. Inspect:
   - 7-class differential probabilities (AKIEC, BKL, DF) with uncalibrated softmax disclosure.
   - Native pixel morphometrics (`area_px: 3,493 px`) and indicative optical estimates (`~3.9 mm²*`).
   - DullRazor hair removal before/after comparison and aligned hair mask.
   - 6-view Explainable AI (XAI) suite with target-class switching and spatial attribution energy ratios.
5. **Report & Consultation Packet**: Download the publication PDF (`107,264 bytes`) embedding figure plates and verification checks.
6. **Care Connect**: Search verified clinics by PIN (`110029` -> AIIMS New Delhi) and verify honest empty results for unlisted PINs (`999999` -> 0 clinics found, zero fabricated providers). Register an appointment request and verify its status is saved as `"Pending"`.
7. **Persistence Verification**: Refresh the browser or restart the backend server; observe that historical analyses and messages are cleanly restored from the durable store.

