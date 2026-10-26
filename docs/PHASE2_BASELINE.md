# OptiDerma — Phase 2 Empirical Baseline & System Audit Record

**Audit Date**: 16 October 2026  
**Evaluator**: Principal Computer-Vision Researcher & Healthcare AI Systems Architect  
**Evaluation Target**: Active Repository Source, Checkpoint Weights, Local Runtimes (FastAPI :8000, Next.js :3000)  

---

## 1. Executive Summary & Verification Findings

This baseline record documents the exact technical findings established by executing live diagnostics, tensor inspections, and test suites across the OptiDerma codebase.

| Area | Baseline Status | Empirical Verification Evidence |
| :--- | :--- | :--- |
| **Model Checkpoint** | **Verified Genuine** | Loaded `model/optiderma_best_model.pth` (PyTorch directory format containing `data.pkl` and 742 tensor files `0`–`741`). Successfully instantiated `OptiDermaNet` with 17,740,464 parameters on CPU. |
| **U-Net Segmentation** | **Verified in Checkpoint** | Checkpoint weights load into decoder modules `up1`–`up4`, `dec1`–`dec4`, `final_up`, and `seg_out` ($16 \to 1$). Inference forward pass on `model/test_lesion.jpg` generates a non-trivial binary mask ($8,527\text{ px}$). However, no annotated ground-truth test split currently exists in the repository, meaning quantitative Dice/IoU accuracy cannot be claimed. |
| **Grad-CAM (XAI)** | **Partially Verified** | Gradients are computed with respect to encoder features `f4` ($1 \times 448 \times 8 \times 8$). Target class selection is functional. However, the visualization is limited to a single blended image; multiple explanation views (raw heatmap, spatial energy inside/outside mask, side-by-side class comparison) are missing. |
| **Hair Removal (DullRazor)** | **Repaired & Validated** | Directional black-hat filter with stroke-thickness geometry ($\frac{2A}{P} \le 7.5\text{ px}$) and lesion ring discrimination passes all 3 synthetic and real tests (19 strands on `test_lesion.jpg`, 0 false positives on clean mole, 3 strands on crossing hairs). |
| **Morphometrics & Scale** | **Uncalibrated Assumption** | Previously assumed a universal 15.0 mm FOV ($30\text{ px/mm}$). In the absence of an optical calibration reticle, presenting measurements as actual $\text{mm}^2$ and $\text{mm}$ without uncalibrated disclosures is clinically unjustified. |
| **Clinical Notes & Reports** | **Superficial Text** | Existing reports contained basic summary paragraphs; lacked 10-section patient guidance, forensic research reproducibility tables, and multi-class XAI diagnostics. |
| **ElevenLabs Voice** | **Unauthenticated Fallback Issue** | Agent `agent_6601m418gdvxe7zr1zksvnmtb3f1` is configured, but no `ELEVENLABS_API_KEY` exists in `.env.local` to mint signed URLs (`/api/voice-session` returns HTTP 503). Client direct connection attempts can fail with `Server error: Unknown error` if prompt overrides are transmitted to public agents. |
| **Persistence (Supabase)** | **DNS Inactive** | `https://uwlatkypjzfnobrobzns.supabase.co` fails DNS resolution (`ENOTFOUND`). Memory fallback prevents crashes, but persistence across restarts is absent. |

---

## 2. Checkpoint Key & Architecture Inventory

Inspection of the loaded `OptiDermaNet` architecture:
- **Backbone**: EfficientNet-B4 (`timm`, features-only, 5 feature stages).
- **Classification Head**:
  - `AdaptiveAvgPool2d((1, 1))` on `f4` ($C=448$).
  - `Dropout(0.3)` $\to$ `Linear(448, 256)` $\to$ `SiLU()` $\to$ `Dropout(0.2)` $\to$ `Linear(256, 7)`.
  - Output logits correspond to 7 ISIC classes: `['akiec', 'bcc', 'bkl', 'df', 'mel', 'nv', 'vasc']`.
- **Segmentation Decoder**:
  - `up1` (`ConvTranspose2d(448, 160, 2, stride=2)`) + skip `f3` ($C=160$) $\to$ `dec1` ($320 \to 160$).
  - `up2` (`ConvTranspose2d(160, 56, 2, stride=2)`) + skip `f2` ($C=56$) $\to$ `dec2` ($112 \to 56$).
  - `up3` (`ConvTranspose2d(56, 32, 2, stride=2)`) + skip `f1` ($C=32$) $\to$ `dec3` ($64 \to 32$).
  - `up4` (`ConvTranspose2d(32, 24, 2, stride=2)`) + skip `f0` ($C=24$) $\to$ `dec4` ($48 \to 24$).
  - `final_up` (`ConvTranspose2d(24, 16, 2, stride=2)`) $\to$ `seg_out` (`Conv2d(16, 1, 1)`).
  - Output tensor shape: $1 \times 1 \times 256 \times 256$ raw logits. Sigmoid activation yields probability map $\in [0, 1]$.

---

## 3. Detailed Gap Analysis & Planned Repairs

1. **Phase 2 — Multi-View XAI Workspace**:
   - Provide dedicated views: (A) Original, (B) Raw Heatmap (independent of skin color), (C) Grad-CAM Overlay with opacity control, (D) Lesion Boundary contour, (E) Attribution-to-lesion comparison (fraction of energy inside mask vs background bleed), (F) Side-by-side differential class attribution comparison.
   - Implement `GET /analysis/{id}/xai` endpoint to recompute Grad-CAM for any class on-demand.
2. **Phase 3 — Honest Hair & Segmentation Disclosures**:
   - Differentiate connected component count from true physical strand count.
   - Explicitly disclose in UI and reports that quantitative Dice/IoU accuracy has not been validated on an annotated benchmark.
3. **Phase 4 — Truthful Physical Units**:
   - Switch primary UI labels to pixel space (`area_px`, `perimeter_px`).
   - Treat millimeter estimates as indicative approximations accompanied by an explicit calibration disclaimer badge.
4. **Phase 5 & 6 — 10-Section Patient Notes & Forensic Technical PDF**:
   - Rebuild `report_service.py` to output 10 structured sections for patients and full reproducibility tables for researchers.
   - Embed figures (Original, Preprocessed, Hair Mask, Segmentation, Grad-CAM) directly into the generated PDF.
5. **Phase 7 — Resilient Voice Integration**:
   - Document root causes of ElevenLabs `Server error: Unknown error`.
   - Prevent sending prohibited prompt overrides to public unauthenticated agents.
   - Ensure client tools retrieve active `analysis_id` data truthfully.
6. **Phase 8 & 9 — Verification & Persistence Truthfulness**:
   - Return structured check items with severity, observed vs expected values.
   - Display a persistent in-memory database warning banner on the UI.
