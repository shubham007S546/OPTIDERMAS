# OptiDerma — Clinical & Research Report Design Specification

**Document Version**: 2.2.0  
**Effective Date**: 16 October 2026  
**System Classification**: Dual-Audience Clinical Decision-Support & Forensic Research Reporting  

---

## 1. Dual-Audience Reporting Architecture

OptiDerma enforces a strict dual-audience reporting architecture:
1. **Patient-Friendly Summary (10 Structured Sections)**:
   Designed for patients and caregivers. Emphasizes calm, reassuring, non-prescriptive language, demystifies AI uncertainty, and equips the patient with constructive questions for their dermatologist.
2. **Technical Research Audit**:
   Designed for clinical researchers, dermatopathologists, and AI validation teams. Emphasizes algorithmic reproducibility, tensor shapes, preprocessing parameters, verification invariant checks, and guideline citations.

---

## 2. Patient-Friendly Report Specification (10 Sections)

| Section | Key Content | Prohibited Elements |
| :--- | :--- | :--- |
| **1. Analysis Overview** | What was scanned, image resolution, and confirmation that pipeline checks passed | Diagnostic finality or certification |
| **2. Observations** | Objective image features (hair density, pigmentation pattern, border smoothness) | Speculative clinical diagnoses or biopsy assumptions |
| **3. AI Prediction Summary** | Top predictions with clear definitions and layman explanations of probability | Presentation of scores as definite certainty |
| **4. Why Result Was Generated** | Plain-language explanation of what Grad-CAM heatmaps highlight | Claiming heatmaps prove malignancy |
| **5. Preprocessing & Quality** | Quality pass status, whether hairs were safely removed without distorting skin | Omitting quality assessment warnings |
| **6. Geometric Measurements** | Native pixel area and perimeter, contour uniformity, ABCDE metrics | Hard claims of micrometric precision without optical reticle |
| **7. What Remains Uncertain** | Missing clinical history, inability of 2D images to evaluate cellular depth | Concealing model limitations or out-of-domain risks |
| **8. Dermatologist Questions** | 3–5 structured questions tailored to the visual findings | Presuming to tell the dermatologist what diagnosis to give |
| **9. Safe Next Steps** | Non-prescriptive guidance (schedule routine dermoscopy, monitor ABCDE) | Prescription dosing, surgical advice, or urgent panicking |
| **10. Evidence & References** | Grounded links to recognized associations (BAD, Cancer Council Australia, IDS) | Hallucinated papers, broken URLs, or unvetted blog posts |

---

## 3. Technical Research Report Specification

The technical audit report provides an immutable forensic record of the inference pipeline:

1. **Metadata & Provenance**:
   - Canonical `analysis_id` (UUIDv4)
   - Checkpoint filename (`optiderma_best_model.pth`), state-dict parameter count (17,740,464 parameters in 742 tensors)
   - Checkpoint SHA hash (`006a77b02a`)
   - Image SHA-256 fingerprint
2. **Preprocessing & DullRazor Diagnostics**:
   - Directional black-hat kernel configuration (multi-scale 9, 17, 25 px, 9 angles)
   - Connected component topological analysis and stroke thickness metric ($\le 7.5\text{ px}$)
   - Inpainting algorithm (Telea, radius $= 3\text{ px}$)
   - Detected hair pixel count and isolated strand count
3. **Inference Pipeline & Architecture**:
   - Input tensor dimensions ($1 \times 3 \times 256 \times 256$), normalization parameters (ImageNet)
   - Classifier head topology ($1792 \to 448 \to 256 \to 7$)
   - U-Net segmentation head ($16 \to 1$ Conv2D, Sigmoid activation, threshold $\tau = 0.5$)
4. **Explainability Attributions**:
   - Grad-CAM target layer (`encoder._conv_head`, $448\text{ ch}$, $8 \times 8$)
   - Class-specific target logit and gradient hook verification
   - Spatial attribution energy localization inside vs outside mask
5. **Deterministic Verification Invariant Suite**:
   - Simplex check: $\left| \sum_{i=1}^7 P_i - 1.0 \right| < 10^{-4}$
   - Bounding geometry bounds: $0.0 < \text{Area}_{\text{mask}} \le 0.95 \times \text{Area}_{\text{total}}$
   - Isoperimetric compactness inequality: $\frac{P^2}{4\pi A} \ge 1.0$
   - Emergency safety triage audit

---

## 4. Server-Side Publication-Grade PDF Generator

- **Engine**: Python `reportlab` (v4.4.11 / v5) via `backend/app/services/report_service.py`
- **Embedded Visual Plate**:
  Embeds 4 genuine analysis figures:
  1. Original Dermoscopy Upload
  2. DullRazor De-Haired Plane
  3. Isolated Hair Mask
  4. Grad-CAM / U-Net Overlay
- **Structured Visual Flow**:
  - Running header with `analysis_id` and timestamp
  - Clinical Verdict & Triage Level banner
  - Multi-Spectral Evidence Figures table
  - Full 7-Class Probability Distribution table
  - ABCDE Morphometrics table with native pixel measurements and calibration disclaimer
  - Independent Verification Engine audit checks
  - Clinical literature and guideline citations
  - Legal non-diagnostic research disclaimer
