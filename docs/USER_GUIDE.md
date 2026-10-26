# OptiDerma — Operational User & Researcher Guide

**Platform Version**: 2.2.0  
**Target Audience**: Clinical researchers, dermatologists, AI verification engineers  
**Supported Environment**: Modern Chromium / Firefox browser, Python 3.12, Node.js 20+  

---

## 1. Quick-Start Execution

To launch the complete OptiDerma multimodal platform locally:

### Step 1: Start the Unified FastAPI Backend
From the repository root:
```bash
# Windows PowerShell
model\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
*Verification*: Navigate to `http://localhost:8000/ready`. You will observe:
```json
{
  "ready": true,
  "model_checkpoint": "C:\\Users\\shubh\\Downloads\\optiderma-1\\model\\optiderma_best_model.pth",
  "architecture": "EfficientNet-B4 (7-class + U-Net)",
  "device": "cpu"
}
```

### Step 2: Start the Next.js Frontend
In a separate terminal:
```bash
pnpm dev
```
Navigate to `http://localhost:3000`.

---

## 2. End-to-End Clinical Analysis Workflow

### Step 1: Uploading a Dermoscopic Image
1. Drag and drop or browse to select a dermoscopy image (`.jpg`, `.jpeg`, `.png`, or `.webp`).
2. The client transmits raw uncompressed bytes directly to `POST /predict`.
3. An automated Image Quality Assessment (IQA) runs first:
   - Verifies resolution ($\ge 150 \times 150\text{ px}$).
   - Evaluates focus sharpness (Laplacian variance $\ge 12.0$).
   - Checks illumination and specular glare.

### Step 2: Research-Grade XAI Studio (Views A–F)
Once inference completes, use the multi-view XAI switcher:
- **A · Raw**: Inspect the untouched, uncompressed input image.
- **B · Raw CAM**: Inspect the pure normalized Jet heatmap without background image interference.
- **C · Overlay**: Inspect the Grad-CAM heatmap blended over the de-haired lesion. Adjust the **Heatmap Opacity** slider ($0\%$ to $100\%$) to reveal underlying pigment structures.
- **D · Boundary**: View the U-Net segmentation contour drawn as an emerald vector polygon.
- **E · Energy**: Review the spatial energy diagnostic:
  - Percentage of activation energy inside the lesion boundary.
  - Mean attribution inside vs outside.
  - Spatial ratio with automatic attribution bleed notifications.
- **F · Compare**: Inspect side-by-side attributions computed independently for competing differential diagnosis classes.

### Step 3: Honest ABCDE Morphometrics
1. Review the ABCDE measurements:
   - **Area & Perimeter**: Reported primarily in **native pixels** (`area_px`, `perimeter_px`).
   - **Indicative mm / mm²**: Accompanied by an explicit disclaimer stating that physical measurements are uncalibrated estimates based on a nominal 15mm dermoscopic contact plate.
   - **Asymmetry Index & Compactness**: Geometric shape indices calculated from the true U-Net contour.
   - **Evolution**: Formally marked as baseline; single images cannot assess longitudinal evolution.

### Step 4: Patient Notes & Technical Research Audit Tabs
Switch between workspace tabs:
- **XAI Studio & Morphometrics**: Interactive visual evidence canvas and differential progression bars.
- **Patient Clinical Notes (10 Sections)**:
  1. Analysis overview
  2. Visual and preprocessing observations
  3. AI prediction summary
  4. Why this result was generated
  5. Image quality and processing audit
  6. Morphological measurements
  7. What remains uncertain
  8. Questions for a dermatologist
  9. Safe next steps
  10. Clinical evidence and references
- **Technical Research & Provenance Audit**:
  Immutable forensic spec detailing checkpoint SHA, target convolution layer (`encoder._conv_head`), 742 tensor parameters, and deterministic verification invariant audits.

### Step 5: ElevenLabs Conversational Voice Assistant
1. Navigate to the **Consult** tab.
2. The Voice Assistant card displays the active analysis UUID and primary condition.
3. Click **Start Voice Consultation** and grant browser microphone permissions.
4. Connection status transitions smoothly through:
   `Idle` $\to$ `Connecting` $\to$ `Connected` $\to$ `Listening` / `Speaking`.
5. Ask questions grounded in the current analysis record:
   - *"What did my current image analysis return?"*
   - *"What are the top predictions?"*
   - *"What does the selected heatmap represent?"*
   - *"Did technical verification pass?"*
   - *"Which measurements are physically calibrated?"*

### Step 6: Publication-Grade PDF Download
1. Click **Download PDF Report** in the top navigation or in the notes workspace.
2. The backend synthesizes a vector PDF embedding:
   - Visual plate with 4 genuine figures: Original, DullRazor De-Haired, Hair Mask, and Grad-CAM / U-Net Overlay.
   - Prediction probabilities table.
   - Morphometrics table with calibration disclosure.
   - Independent verification audit log.
   - Clinical references and legal research disclaimers.
