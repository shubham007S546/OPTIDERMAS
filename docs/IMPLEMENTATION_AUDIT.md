# OptiDerma — Implementation Audit & Architectural Discovery Report

**Audit Date**: 15 October 2026  
**Status**: Executed on real repository assets, live Python 3.12 virtualenv, PyTorch checkpoints, and Next.js 16 build.  
**Auditor**: Principal AI Engineer & Medical AI Systems Lead  

---

## 1. Executive Summary & Verification Findings

An exhaustive, evidence-based audit was executed on the current state of the OptiDerma codebase. Below are key findings:

1. **PyTorch Checkpoint Verification**:
   - File: `model/optiderma_best_model.pth`
   - Keys in checkpoint: **742 state-dict tensors**.
   - Output heads: **Both the 7-class linear classifier and the U-Net segmentation decoder exist in the trained weights!**
   - Checkpoint inspection confirmed keys including `encoder.*` (EfficientNet-B4), `classifier.*` (448->256->7), and `up1..up4`, `dec1..dec4`, `seg_out` (16->1 conv2d).
   - Class order configured in code: `['akiec', 'bcc', 'bkl', 'df', 'mel', 'nv', 'vasc']` (Alphabetical order).
   - Test inference on `model/test_lesion.jpg` executed successfully, generating top-3 differential diagnosis, real U-Net segmentation mask (8,527 non-zero pixels), and lesion morphometrics (area: 29.28 mm²).

2. **Frontend & Next.js 16 / React 19 State**:
   - `tsc --noEmit`: **0 errors**. Strict TypeScript compilation passed cleanly.
   - `next build`: **0 errors**. Production static and dynamic route compilation succeeded in 12.7s.
   - UI features a 3D Three.js neural brain visualization, dark/light theme toggle, upload dropzone, results card, and ElevenLabs voice assistant component.

3. **Critical Architectural Faults Discovered**:
   - **Flawed DullRazor Hair Removal & Mask generation**: In `model/preprocessor.py`, `remove_hair()` was called on the de-haired image a second time to produce the diagnostic mask. This returned an empty or invalid mask instead of measuring hair detected on the raw image.
   - **Dual-Backend Disconnection**: Two separate server files existed (`model/server.py` and `backend/app/main.py`). `package.json` only spawned `model/server.py`. The multi-agent RAG, safety triage, and medical reasoning features in `backend/app` were isolated and never reached by the frontend.
   - **Missing Required API Endpoints**: `/ready`, `POST /analyze`, `POST /analysis/{analysis_id}/verify`, `GET /analysis/{analysis_id}`, and `GET /analysis/{analysis_id}/report` were either missing or using mismatched schemas.
   - **Grad-CAM Class Constraint**: Grad-CAM was locked strictly to the top-1 predicted class (`cls_logits.argmax(1)`), preventing explainability generation for other differential diagnoses.
   - **Independent Verification Missing**: No automated verification agent verified tensor shapes, probability normalization, mask bounding bounds, or morphological reasonableness before surfacing outputs.
   - **Voice Agent Context Disconnect**: While `@elevenlabs/react` was configured, voice sessions were not tied to a canonical `analysis_id` across the backend and frontend.
   - **Supabase DNS Failure**: The configured project URL `https://uwlatkypjzfnobrobzns.supabase.co` fails DNS resolution (`ENOTFOUND`). While the memory fallback prevents crashes, persistence is completely severed.

---

## 2. Issues, Root Causes, Affected Files & Action Plan

| Issue ID | Subsystem | Description & Root Cause | Affected Files | Planned Concrete Fix |
| :--- | :--- | :--- | :--- | :--- |
| **AUDIT-01** | **Computer Vision** | **DullRazor mask & artifacting flaw**: `preprocessor.py` computes hair mask on an already de-haired image (`remove_hair(clean_256_bgr)`). Also, morphological parameters did not return diagnostic metrics or handle dark vs light hairs safely. | `model/preprocessor.py`, `backend/app/vision/` | Rewrite `remove_hair(image) -> dict` returning `processed_image`, `hair_mask`, `diagnostics`, `status`, before/after comparisons, and preserve raw pixels without blurring non-hair structures. |
| **AUDIT-02** | **Backend Architecture** | **Dual backend fragmentation**: `model/server.py` and `backend/app/main.py` duplicate server duties. `pnpm api` only ran `model/server.py`. RAG and Safety triage were bypassed. | `package.json`, `model/server.py`, `backend/app/main.py`, `backend/app/api/router.py` | Unify into one primary FastAPI application with backward-compatible `/predict` and `/health`, plus unified `/ready`, `/analyze`, `/analysis/{id}`, `/verify`, and `/report`. |
| **AUDIT-03** | **Explainability (XAI)** | **Grad-CAM hardcoded to top-1**: Cannot generate activation heatmaps for alternative differential classes (e.g. BCC or Melanoma if top-1 is AKIEC). | `model/model_pipeline.py`, `model/server.py` | Add `target_class` parameter to Grad-CAM pipeline, allowing selective class activation inspection and sanity checks. |
| **AUDIT-04** | **Safety & Verification** | **Absence of Independent Verifier**: Pipeline returned raw model outputs without validating sanity (e.g. valid probability distribution, mask bounding bounds, non-trivial contours, emergency red flags). | *New Service*: `backend/app/services/verification_service.py` | Implement deterministic verification agent checking model availability, input validity, IQA, output bounds, morphometrics, and safety overrides. |
| **AUDIT-05** | **Voice Integration** | **ElevenLabs Session not bound to Canonical Analysis ID**: The voice agent relied on ephemeral client React state; could not query backend analysis by ID or verify analysis freshness. | `components/voice-assistant.tsx`, `backend/app/api/analysis.py` | Bind every analysis to an `analysis_id`. Expose typed tools and dynamic variables for ElevenLabs referencing the verified analysis ID. |
| **AUDIT-06** | **Reporting & Evidence** | **Lack of Truthful Multi-Format Reports & PDF Export**: The dashboard lacked structured Patient vs Technical reports and had no server/client PDF export for researchers and patients. | *New Service & Route*: `backend/app/services/report_service.py`, `components/results-view.tsx` | Implement genuine report generator producing patient-friendly and technical research reports, with printable and downloadable PDF formats. |
| **AUDIT-07** | **Database & Persistence** | **Supabase Project DNS Resolution Failure**: `uwlatkypjzfnobrobzns.supabase.co` is inactive. In-memory fallback exists, but users are not truthfully informed of persistence status. | `lib/supabase.ts`, `app/api/bookings/route.ts`, `.env.local` | Provide transparent status in booking UI, document setup/migration, and allow pluggable Postgres/Supabase credentials. |
| **AUDIT-08** | **RAG Knowledge Base** | **Static in-memory passages lack real medical literature citations**: RAG passages in `dermatology_rag.py` were brief samples without verified PubMed / clinical guideline citations and retrieval tracking. | `backend/app/rag/dermatology_rag.py` | Upgrade knowledge base with verified dermatology guideline citations (AAD, BAD, dermoscopy criteria), source metadata, and citation validation. |

---

## 3. End-to-End Data Flow Verification

```
[User Image Upload (Raw Bytes)]
              │
              ▼
[Input Validation (MIME, <20MB, Dimension Check)]
              │
              ▼
[Image Quality Assessment (IQA: Blur, Glare, Contrast, Exposure)]
              │
              ▼
[Enhanced DullRazor (Black-Hat Filtering, Inpainting, Diagnostic Mask)]
              │
              ▼
[Preprocessed Tensor (256x256, ImageNet Normalization)]
              │
              ▼
[OptiDermaNet (EfficientNet-B4 + Classifier + U-Net Segmentation)]
              │
              ├────────────────────────┬────────────────────────┐
              ▼                        ▼                        ▼
     [7-Class Differential]   [Real U-Net Mask]         [Grad-CAM Attention]
              │                        │                        │
              └────────────────────────┼────────────────────────┘
                                       │
                                       ▼
                       [Morphometrics Calculation (Area, Asymmetry, etc.)]
                                       │
                                       ▼
                       [Independent Verification Service (Deterministic Sanity)]
                                       │
                                       ▼
                       [Emergency Safety Triage & Dermatology RAG Retrieval]
                                       │
                                       ▼
                       [Canonical Analysis Record (UUID `analysis_id`)]
                                       │
              ┌────────────────────────┴────────────────────────┐
              ▼                                                 ▼
[Frontend UI & Explainability Controls]               [ElevenLabs Voice Context]
  • Top-3 differential probabilities                   • Analysis summary injection
  • Class-selectable Grad-CAM heatmap                  • Voice client tools (get_analysis)
  • Real segmentation mask toggle                      • Clinical follow-up questions
  • Patient & Technical Report + PDF
```

---

## 4. Immediate Action Items

1. **Step 1**: Repair and standardize DullRazor in `model/preprocessor.py` with full diagnostics, non-destructive hair detection, and mask generation.
2. **Step 2**: Enhance `model/model_pipeline.py` with multi-class Grad-CAM target selection and sanity checks.
3. **Step 3**: Implement the Independent Verification Service (`verification_service.py`).
4. **Step 4**: Unify the backend API in `backend/app/` to serve `/health`, `/ready`, `/predict`, `/analyze`, `/analysis/{id}`, `/verify`, and `/report`. Update `package.json` to start this unified server on port 8000.
5. **Step 5**: Connect frontend `lib/api.ts`, `voice-assistant.tsx`, and `opti-derma-dashboard.tsx` with canonical `analysis_id`, verifiable reports, and real hair removal inspection.
6. **Step 6**: Execute automated and end-to-end integration tests.
