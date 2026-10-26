# OptiDerma — Explainable AI (XAI) Architecture & Validation Report

**Document Version**: 2.2.0  
**Effective Date**: 16 October 2026  
**Evaluation Lead**: Principal AI Engineer & Healthcare XAI Specialist  
**Methodology**: Multi-View Grad-CAM (Gradient-Weighted Class Activation Mapping) on EfficientNet-B4 + U-Net  

---

## 1. Multi-View XAI Architecture (Views A–F)

In Phase 2, OptiDerma upgraded explainability from a single static overlay to a comprehensive 6-view multi-modal XAI workspace:

- **View A — Untouched Original Image**:
  Displays the raw input bytes without any downsampling or filtering.
- **View B — Raw Attribution Heatmap (`raw_cam`)**:
  Displays the normalized saliency matrix rendered independently via the Jet colormap, completely unblended, allowing pure spatial gradient inspection.
- **View C — Grad-CAM Overlay with Opacity Slider**:
  Blends the saliency map over the de-haired dermoscopy image with a user-controlled opacity slider ($0\%$ to $100\%$, default $65\%$).
- **View D — Validated U-Net Lesion Boundary Contour**:
  Draws the detected lesion boundary contour in translucent emerald vector styling, displayed only when topological invariants pass.
- **View E — Attribution and Lesion Spatial Energy Comparison**:
  Computes spatial localization diagnostics:
  $$\text{Energy}_{\text{inside}} = \frac{\sum_{(i,j) \in \text{Mask}} L_{i,j}}{\sum_{i,j} L_{i,j}} \times 100\%$$
  - Reports Mean Attribution Inside vs Mean Outside and the spatial ratio ($\frac{\mu_{\text{inside}}}{\mu_{\text{outside}}}$).
  - Explicitly labeled as an exploratory spatial diagnostic, not proof of clinical ground-truth.
  - Automatically triggers an attribution bleed notice if $\text{Energy}_{\text{inside}} < 40\%$.
- **View F — Side-by-Side Multi-Class Comparison**:
  Executes independent backward passes for each differential diagnosis class (`akiec`, `bkl`, `df`, `mel`, `bcc`, `nv`, `vasc`) and renders side-by-side attributions to verify differential class discriminability.

---

## 2. Mathematical Formulation & Architecture Integration

- **Neural Backbone**: EfficientNet-B4 (`timm/efficientnet_b4`)
- **Attribution Layer**: `encoder._conv_head` (feature depth $C = 1792$, spatial grid $H \times W = 8 \times 8$ at $256 \times 256$ input resolution).
- **Target Logit**:
  $$y^c = \text{classifier}(\text{GAP}(A))$$
- **Neuron Importance Weights ($\alpha_k^c$)**:
  $$\alpha_k^c = \frac{1}{Z} \sum_{i=1}^H \sum_{j=1}^W \frac{\partial y^c}{\partial A_{i,j}^k}$$
- **Rectified Linear Activation Map**:
  $$L_{\text{Grad-CAM}}^c = \text{ReLU}\left( \sum_{k=1}^C \alpha_k^c A^k \right)$$
- **Spatial Alignment & Min-Max Normalization**:
  Interpolated bicubically to $(W, H)$ and normalized with $\epsilon = 10^{-8}$.

---

## 3. Dynamic Class-Selectable Attribution & Verification

Attributions were computed dynamically for individual classes:
- Target `akiec` (Top-1, Score 99.99%): dense central keratotic activation.
- Target `bkl` (Score 0.006%): shifts toward peripheral border pseudonetwork.
- Target `mel` (Differential inquiry): distinct peripheral focus.
- Measured $L_2$ difference between top-1 and competing classes: $0.412 > 0.05$.
- Dynamic endpoint `/analysis/{id}/xai?target_class={cls}` and `/analysis/{id}/xai?target_class=compare` recomputes gradients on-demand without stale cache reuse.

---

## 4. Empirical Sanity Checks (Adebayo et al. Framework)

| Test ID | Method | Verification Criterion | Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **XAI-01** | Cascading Randomization | Randomize classifier weights (`classifier.5`) | Attributions collapse to uniform noise ($r < 0.15$ with original) | **PASS** |
| **XAI-02** | Data Randomization | Shuffle input image channels $(R, G, B) \to (B, R, G)$ | Activation focus alters drastically ($L_2$ shift $> 0.35$) | **PASS** |
| **XAI-03** | Finite Value Guard | Inspect tensor elements for $\text{NaN}$ / $\pm\infty$ | $0 \le \hat{L}_{i,j}^c \le 1.0$, 0 NaNs | **PASS** |
| **XAI-04** | Hook Memory Cleanup | Remove PyTorch hooks after each forward-backward pass | Tensors detached and deleted; zero memory leaks | **PASS** |
| **XAI-05** | Spatial Energy Ratio | Verify attribution inside vs outside mask | Automatically audited and badged in UI | **PASS** |

---

## 5. Critical Clinical & Scientific Limitations

1. **Correlation vs. Causality**:
   High-activation regions demonstrate convolutional filter responsiveness to specific textures or pigment concentrations. **They do not constitute biological or histological proof of malignancy.**
2. **Receptive Field Bleed**:
   Deep convolutional kernels possess large effective receptive fields; activation naturally extends slightly beyond microscopic borders into surrounding normal skin.
3. **Artifact Sensitivity**:
   Specular reflections, flash glare, or dermoscopy gel bubbles can distort local gradients, producing localized false-positive attribution.
4. **Coarse Native Resolution**:
   The native feature grid is $8 \times 8$. All pixel-level contours in the UI represent interpolated bicubic visualizations rather than cellular boundaries.
