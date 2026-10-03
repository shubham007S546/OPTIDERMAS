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
5. **ElevenLabs Conversational Voice Assistant**
   - Secure server route (`/api/voice-session`) requesting signed conversation URLs with origin validation and per-IP rate limiting.
   - Client component built on `@elevenlabs/react` `useConversation`.
   - Passes strictly **text-only** contextual summaries (`analysis_summary` dynamic variable) containing top predictions, risk level, and metrics. Raw image bytes are **never** passed to the voice model.
   - Live microphone permission handling, mute controls, in-memory short transcripts, and 90-second inactivity auto-termination.
6. **Honest Evaluation & Limitations**
   - Transparent reporting of benchmark metrics on HAM10000 (1,002 image-level test split: 95.4% accuracy, 0.94 macro F1, 0.988 AUC, 0.87 melanoma recall; 589 unseen lesions: 96.8% accuracy, 0.70 melanoma recall).
   - Complete documentation of dataset limitations and lack of external multi-center clinical validation.

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
| `ELEVENLABS_API_KEY` | For Voice | - | Server-only ElevenLabs API key (never exposed to client) |
| `ELEVENLABS_AGENT_ID` | For Voice | - | ElevenLabs conversational agent identifier |

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

### 3. Verify Code Quality & Type Safety

```bash
# Validate strict TypeScript compilation
pnpm exec tsc --noEmit

# Run Next.js production build
pnpm build
```

---

## Backend Contract

The Next.js application connects to an inference backend implementing the following contract:

- `GET /health` → `{"ok": true}`
- `POST /predict` (`multipart/form-data`, field `file`, max 20 MB)
  - Returns `probs`, `top3`, `malignant_flag`, `malignant_prob`, `risk`, `metrics`, and optional `images`.
  - See [`docs/sample-response.json`](docs/sample-response.json) for the golden schema fixture.
