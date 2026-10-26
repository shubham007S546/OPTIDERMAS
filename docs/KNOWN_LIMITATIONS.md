# OptiDerma — Known Limitations, Clinical Disclosures & Operational Constraints

**Document Version**: 2.2.0  
**Effective Date**: 16 October 2026  
**Clinical Status**: Investigational Decision-Support Software (Not FDA-Cleared)  

---

## 1. Regulatory & Diagnostic Disclaimers

1. **Non-Diagnostic Decision-Support**: OptiDerma is designed strictly as a computer-vision and multimodal decision-support research platform. It **does not constitute a medical device**, diagnostic apparatus, or definitive clinical tool under FDA (21 CFR), EMA, or MHRA regulations.
2. **Histopathology Requirement**: No artificial intelligence model can replace formal histopathological examination (biopsy) and dermatoscopy evaluation performed by a board-certified dermatologist.
3. **No Prescriptive Authority**: OptiDerma is architected with deterministic safety barriers prohibiting the prescription, recommendation, or dosage calculation of any pharmaceutical compound or therapeutic intervention.

---

## 2. Model Architecture & Checkpoint Characteristics

1. **Checkpoint File Structure**:
   - The model checkpoint `model/optiderma_best_model.pth` is a **directory** containing 742 individual tensor weight shards and a `data.pkl` header (17,740,464 total parameters).
   - Calling standard Python `open()` directly on this path raises `PermissionError: [Errno 13]`. The pipeline uses `model_pipeline.resolve_checkpoint()` to dynamically bundle the shard directory into a temporary ZIP archive for PyTorch loading.
2. **Training Data Domain Constraints**:
   - The backbone was trained on dermoscopic benchmarks (HAM10000 / ISIC archives). Submitting macroscopic smartphone photos captured under ambient lighting introduces domain shift, which may degrade prediction confidence and segmentation contour quality.
   - Datasets predominantly represent Fitzpatrick skin phototypes I–III. Performance on darker phototypes (IV–VI) has not been verified in multi-center clinical trials.

---

## 3. Physical Calibration & Morphometric Limitations

1. **Uncalibrated Optical Scaling**:
   - In the absence of an optical reticle, calibration ruler, or sensor pitch metadata, metric measurements ($mm$ and $mm^2$) represent uncalibrated estimates based on a nominal $15\text{ mm}$ field-of-view ($30\text{ pixels/mm}$).
   - OptiDerma exposes native pixel dimensions (`area_px`, `perimeter_px`) as primary ground truth, with metric values clearly marked as indicative estimates.
2. **Evolution & Longitudinal Assessment**:
   - Lesion evolution (the 'E' in ABCDE) cannot be determined from a single photographic capture. Accurate evolution tracking requires registered prior images, identical lighting geometry, and verified acquisition metadata.

---

## 4. Explainable AI (XAI) & Saliency Constraints

1. **Attribution Bleed & Receptive Field**:
   - Deep convolutional kernels in `encoder._conv_head` have expansive effective receptive fields. Gradient activation frequently extends into healthy skin bordering the lesion.
   - The UI provides an exploratory **Spatial Attribution Energy Ratio** (View E), flagging analyses where less than $40\%$ of saliency energy falls within the segmented lesion mask.
2. **Class Saliency Contrasts**:
   - High activation indicates feature relevance to a specific logit under the Grad-CAM formulation. It does not establish causal biological malignancy.
   - For highly correlated classes (e.g., Actinic Keratosis and Basal Cell Carcinoma), activation patterns may partially overlap.

---

## 5. Infrastructure & Persistence Constraints

1. **Supabase Cloud Schema & Migration State**:
   - The configured Supabase remote project (`https://uwlatkypjzfnobrobzns.supabase.co`) is reachable and authenticates via its publishable key.
   - However, tables (`public.analyses`, `public.analysis_artifacts`, `public.bookings`) have not yet been instantiated in the Supabase PostgreSQL database. PostgREST returns `PGRST205: Could not find table in schema cache`.
   - Publishable anon keys cannot execute DDL (`CREATE TABLE`). Enabling cloud synchronization requires executing `docs/supabase_schema.sql` via direct PostgreSQL credentials or the Supabase SQL Editor.
   - **Authoritative Durable Store**: In the interim, OptiDerma durably persists all canonical analyses, XAI vectors, multi-turn conversations, and appointment requests in the local SQLite database (`backend/data/optiderma_persistence.db`) running in WAL mode, verified to survive complete application process restarts.
2. **ElevenLabs Voice Assistant**:
   - Voice interaction requires an active internet connection, browser microphone access, and valid ElevenLabs agent availability (`agent_6601m418gdvxe7zr1zksvnmtb3f1`).
   - When running in unauthenticated public agent mode, client-side prompt overrides are omitted to prevent WebSocket handshake rejection. Dynamic variables and client tools ground the conversation in the active `analysis_id`.
