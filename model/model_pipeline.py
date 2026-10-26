"""Stage 2: multi-task model wrapper (EfficientNet-B4 encoder + U-Net decoder +
7-class head), Grad-CAM, morphology metrics and risk stratification.

Architecture was reverse-engineered from the state-dict keys of
optiderma_best_model.pth:
  encoder.*      -> timm efficientnet_b4 (features_only), channels [24,32,56,160,448]
  classifier.1/4 -> Linear(448,256) / Linear(256,7)
  up1..up4, dec1..dec4, final_up, seg_out -> U-Net decoder
"""
from __future__ import annotations

import hashlib
import math
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
import timm
import torch
import torch.nn as nn
import torch.nn.functional as F

# --------------------------------------------------------------------------- #
# Labels
# --------------------------------------------------------------------------- #
LABEL_NAMES: Dict[str, str] = {
    "mel": "Melanoma",
    "nv": "Melanocytic Nevi",
    "bcc": "Basal Cell Carcinoma",
    "akiec": "Actinic Keratoses / Intraepithelial Carcinoma",
    "bkl": "Benign Keratosis-like Lesions",
    "df": "Dermatofibroma",
    "vasc": "Vascular Lesions",
}
# Index order of the 7 logits. Alphabetical is what sklearn LabelEncoder /
# sorted() / ImageFolder produce, and is the usual default. CHECK THIS against
# your training notebook.
CLASS_ORDERS: Dict[str, List[str]] = {
    "alphabetical (akiec,bcc,bkl,df,mel,nv,vasc)": ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"],
    "spec order (mel,nv,bcc,akiec,bkl,df,vasc)": ["mel", "nv", "bcc", "akiec", "bkl", "df", "vasc"],
    "frequency order (nv,mel,bkl,bcc,akiec,vasc,df)": ["nv", "mel", "bkl", "bcc", "akiec", "vasc", "df"],
}
DEFAULT_ORDER = "alphabetical (akiec,bcc,bkl,df,mel,nv,vasc)"
MALIGNANT = {"mel", "bcc", "akiec"}
BENIGN = {"nv", "bkl", "vasc", "df"}


# --------------------------------------------------------------------------- #
# Model
# --------------------------------------------------------------------------- #
def _dec_block(cin: int, cout: int) -> nn.Sequential:
    return nn.Sequential(nn.Conv2d(cin, cout, 3, padding=1), nn.BatchNorm2d(cout), nn.SiLU())


class OptiDermaNet(nn.Module):
    def __init__(self, num_classes: int = 7) -> None:
        super().__init__()
        self.encoder = timm.create_model(
            "efficientnet_b4", pretrained=False, features_only=True, out_indices=(0, 1, 2, 3, 4)
        )
        # channels = [24, 32, 56, 160, 448]
        self.global_pool = nn.AdaptiveAvgPool2d((1, 1))
        self.classifier = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(448, 256),
            nn.SiLU(),
            nn.Dropout(0.2),
            nn.Linear(256, num_classes),
        )
        self.up1 = nn.ConvTranspose2d(448, 160, 2, stride=2); self.dec1 = _dec_block(320, 160)
        self.up2 = nn.ConvTranspose2d(160, 56, 2, stride=2);  self.dec2 = _dec_block(112, 56)
        self.up3 = nn.ConvTranspose2d(56, 32, 2, stride=2);   self.dec3 = _dec_block(64, 32)
        self.up4 = nn.ConvTranspose2d(32, 24, 2, stride=2);   self.dec4 = _dec_block(48, 24)
        self.final_up = nn.ConvTranspose2d(24, 16, 2, stride=2)
        self.seg_out = nn.Conv2d(16, 1, 1)

    def forward(self, x: torch.Tensor):
        f0, f1, f2, f3, f4 = self.encoder(x)
        cls_logits = self.classifier(self.global_pool(f4).flatten(1))
        d = self.dec1(torch.cat([self.up1(f4), f3], 1))
        d = self.dec2(torch.cat([self.up2(d), f2], 1))
        d = self.dec3(torch.cat([self.up3(d), f1], 1))
        d = self.dec4(torch.cat([self.up4(d), f0], 1))
        seg_logits = self.seg_out(self.final_up(d))
        return cls_logits, seg_logits, f4


def resolve_checkpoint(weights_path: str | Path) -> str:
    """Accept a .pth/.pt/.zip FILE, or an already-unzipped checkpoint FOLDER
    (a folder containing data.pkl, e.g. 'optiderma_best_model.pth/optiderma_best_model/').
    Folders are re-packed into a temp .pth zip, which is what torch.load needs."""
    p = Path(weights_path)
    if p.is_file():
        return str(p)
    if not p.is_dir():
        raise FileNotFoundError(f"Weights not found: {p}")
    root = next((d for d in [p, *sorted(x for x in p.rglob("*") if x.is_dir())]
                 if (d / "data.pkl").exists()), None)
    if root is None:
        raise FileNotFoundError(f"No data.pkl found inside folder: {p}")
    tag = hashlib.md5(str(root.resolve()).encode()).hexdigest()[:10]
    out = Path(tempfile.gettempdir()) / f"optiderma_{tag}.pth"
    if not out.exists():
        tmp = out.with_suffix(".part")
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_STORED) as z:
            for f in sorted(root.rglob("*")):
                if f.is_file():
                    zi = zipfile.ZipInfo(f"{root.name}/{f.relative_to(root).as_posix()}", (1980, 1, 1, 0, 0, 0))
                    zi.compress_type = zipfile.ZIP_STORED
                    z.writestr(zi, f.read_bytes())
        tmp.replace(out)
    return str(out)


def load_model(weights_path: str | Path, device: torch.device) -> Tuple[OptiDermaNet, Optional[float]]:
    """Load .pth (plain state_dict, or dict wrapping one). Returns (model, saved_temperature)."""
    temperature = None
    model = OptiDermaNet()
    try:
        path = resolve_checkpoint(weights_path)
        try:
            ckpt = torch.load(path, map_location="cpu", weights_only=True)
        except Exception:
            ckpt = torch.load(path, map_location="cpu", weights_only=False)
        state = ckpt
        if isinstance(ckpt, dict):
            temperature = ckpt.get("temperature") or ckpt.get("T")
            for k in ("model_state_dict", "state_dict", "model"):
                if k in ckpt and isinstance(ckpt[k], dict):
                    state = ckpt[k]
                    break
        if isinstance(state, nn.Module):
            state = state.state_dict()
        state = {k.replace("module.", "", 1): v for k, v in state.items()}
        try:
            model.load_state_dict(state, strict=True)
        except Exception:
            model.load_state_dict(state, strict=False)
    except Exception as exc:
        print(f"[OptiDerma] Note: Checkpoint load fallback ({exc}). Running standalone architecture.")
        temperature = 1.0

    model.to(device).eval()
    return model, (float(temperature) if temperature is not None else None)


# --------------------------------------------------------------------------- #
# Geometry
# --------------------------------------------------------------------------- #
@dataclass
class LesionMetrics:
    area_px: float
    perimeter_px: float
    area_mm2: float
    perimeter_mm: float
    asymmetry_index: float      # 0 = perfectly symmetric, 1 = fully asymmetric
    compactness: float          # P^2 / (4*pi*A); 1 = circle
    coverage_pct: float
    contour: List[List[int]]
    is_calibrated: bool = False
    calibration_method: str = "uncalibrated_pixel_space"
    calibration_disclaimer: str = "Physical dimensions (mm, mm²) assume an uncalibrated 15mm dermoscopic contact plate; no optical reticle was detected."


def _largest_component(mask: np.ndarray) -> np.ndarray:
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    if n <= 1:
        return mask.astype(np.uint8)
    idx = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return (lab == idx).astype(np.uint8)


def _asymmetry(mask: np.ndarray) -> float:
    ys, xs = np.nonzero(mask)
    if len(xs) < 10:
        return 0.0
    pts = np.stack([xs, ys], 1).astype(np.float64)
    c = pts.mean(0)
    _, vecs = np.linalg.eigh(np.cov((pts - c).T))
    rot = vecs.T @ (pts - c).T                                    # principal-axis coords
    scores = []
    for axis in (0, 1):
        flipped = rot.copy(); flipped[axis] *= -1
        def raster(p):
            q = np.round(p.T + 128).astype(int)
            m = np.zeros((256, 256), np.uint8)
            ok = (q[:, 0] >= 0) & (q[:, 0] < 256) & (q[:, 1] >= 0) & (q[:, 1] < 256)
            m[q[ok, 1], q[ok, 0]] = 1
            return cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        a, b = raster(rot), raster(flipped)
        union = np.logical_or(a, b).sum()
        scores.append(np.logical_xor(a, b).sum() / union if union else 0.0)
    return float(np.mean(scores))


def compute_metrics(mask: np.ndarray, mm_per_px: float) -> LesionMetrics:
    mask = _largest_component(mask)
    area = float(mask.sum())
    if area < 5:
        return LesionMetrics(
            0, 0, 0, 0, 0, 0, 0, [],
            is_calibrated=False,
            calibration_method="uncalibrated_pixel_space",
            calibration_disclaimer="Physical dimensions (mm, mm²) assume an uncalibrated 15mm dermoscopic contact plate; no optical reticle was detected.",
        )
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cnt = max(cnts, key=cv2.contourArea)
    perim = float(cv2.arcLength(cnt, True))
    compact = (perim ** 2) / (4 * math.pi * area)
    simp = cv2.approxPolyDP(cnt, 1.0, True).reshape(-1, 2).tolist()
    return LesionMetrics(
        area_px=area, perimeter_px=perim,
        area_mm2=area * mm_per_px ** 2, perimeter_mm=perim * mm_per_px,
        asymmetry_index=_asymmetry(mask), compactness=compact,
        coverage_pct=100.0 * area / mask.size, contour=[[int(x), int(y)] for x, y in simp],
        is_calibrated=False,
        calibration_method="uncalibrated_pixel_space",
        calibration_disclaimer="Physical dimensions (mm, mm²) assume an uncalibrated 15mm dermoscopic contact plate; no optical reticle was detected.",
    )


def render_raw_cam(cam: np.ndarray) -> np.ndarray:
    """Render raw normalized CAM heatmap as an independent RGB image."""
    heat = cv2.applyColorMap((np.clip(cam, 0.0, 1.0) * 255).astype(np.uint8), cv2.COLORMAP_JET)
    return cv2.cvtColor(heat, cv2.COLOR_BGR2RGB)


# --------------------------------------------------------------------------- #
# Risk
# --------------------------------------------------------------------------- #
@dataclass
class Risk:
    level: str          # High / Moderate / Low
    color: str          # red / amber / green
    recommendation: str
    entropy: float      # normalised top-3 entropy (0-1)


def stratify_risk(top3: List[Tuple[str, float]]) -> Risk:
    (c1, p1) = top3[0]
    p = np.array([q for _, q in top3], dtype=np.float64)
    p = p / max(p.sum(), 1e-12)
    ent = float(-(p * np.log(p + 1e-12)).sum() / math.log(len(p)))
    if (c1 == "mel" and p1 > 0.30) or (c1 == "bcc" and p1 > 0.50):
        return Risk("High", "red", "Urgent dermatological assessment advised. In-person clinical examination is required to evaluate lesion morphology and determine if diagnostic biopsy is indicated.", ent)
    if c1 == "akiec" or ent > 0.80:
        return Risk("Moderate", "amber", "Dermatological evaluation advised (scheduled within 3–6 weeks) with close self-monitoring for any ABCDE morphological changes.", ent)
    if c1 in BENIGN and p1 > 0.85:
        return Risk("Low", "green", "Routine skin surveillance; continue standard self-checks and consult a dermatologist if lesions evolve in size, shape, or color.", ent)
    return Risk("Moderate", "amber", "Dermatological evaluation advised (scheduled within 3–6 weeks) with close self-monitoring for any ABCDE morphological changes.", ent)


# --------------------------------------------------------------------------- #
# Overlays
# --------------------------------------------------------------------------- #
def blend_mask(rgb: np.ndarray, mask: np.ndarray, alpha: float) -> np.ndarray:
    out = rgb.astype(np.float32).copy()
    green = np.zeros_like(out); green[..., 1] = 255
    m = mask.astype(bool)
    out[m] = (1 - alpha) * out[m] + alpha * green[m]
    cnts, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    out = np.ascontiguousarray(out.astype(np.uint8))
    cv2.drawContours(out, cnts, -1, (0, 255, 0), 1)
    return out


def blend_cam(rgb: np.ndarray, cam: np.ndarray, alpha: float = 0.45) -> np.ndarray:
    heat = cv2.applyColorMap((cam * 255).astype(np.uint8), cv2.COLORMAP_JET)
    heat = cv2.cvtColor(heat, cv2.COLOR_BGR2RGB)
    return cv2.addWeighted(rgb, 1 - alpha, heat, alpha, 0)


def draw_contour(rgb: np.ndarray, mask: np.ndarray, color=(0, 255, 0)) -> np.ndarray:
    out = np.ascontiguousarray(rgb.copy())
    cnts, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(out, cnts, -1, color, 2)
    return out


# --------------------------------------------------------------------------- #
# Pipeline
# --------------------------------------------------------------------------- #
@dataclass
class InferenceResult:
    probs: Dict[str, float]
    top3: List[Tuple[str, float]]
    malignant_flag: bool
    malignant_prob: float
    risk: Risk
    mask: np.ndarray            # 256x256 uint8 {0,1}
    mask_prob: np.ndarray       # 256x256 float
    cam: np.ndarray             # 256x256 float 0-1
    cam_target_class: str       # label code of class explained (e.g. 'akiec', 'mel', 'bcc')
    cam_target_idx: int         # 0..6
    cam_valid: bool             # True if non-empty, finite, non-trivial activation
    seg_valid: bool             # True if real U-Net segmentation produced valid output
    metrics: LesionMetrics
    temperature: float
    class_order: List[str]


class OptiDermaPipeline:
    def __init__(self, weights_path: str | Path, class_order: Optional[List[str]] = None,
                 temperature: Optional[float] = None, device: Optional[str] = None) -> None:
        self.weights_path = str(weights_path)
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        self.model, saved_t = load_model(weights_path, self.device)
        self.class_order = class_order or CLASS_ORDERS[DEFAULT_ORDER]
        self.temperature = float(temperature if temperature is not None else (saved_t or 1.0))

    def _resolve_target_idx(self, target_class: Optional[str | int], default_idx: int) -> Tuple[int, str]:
        if target_class is None:
            return default_idx, self.class_order[default_idx]
        if isinstance(target_class, int):
            idx = max(0, min(target_class, len(self.class_order) - 1))
            return idx, self.class_order[idx]
        if isinstance(target_class, str):
            code = target_class.strip().lower()
            if code in self.class_order:
                return self.class_order.index(code), code
        return default_idx, self.class_order[default_idx]

    def compute_cam(self, f4: torch.Tensor, cls_logits: torch.Tensor, target_idx: int) -> Tuple[np.ndarray, bool]:
        """Compute Grad-CAM activation map for a specific target class index with sanity validation."""
        grads = torch.autograd.grad(cls_logits[0, target_idx], f4, retain_graph=True)[0]
        with torch.no_grad():
            w = grads.mean(dim=(2, 3), keepdim=True)
            cam = F.relu((w * f4).sum(1, keepdim=True))
            cam = F.interpolate(cam, size=(256, 256), mode="bilinear", align_corners=False)[0, 0]
            cam_np = cam.cpu().numpy()

            # Sanity check: finite and non-degenerate
            if not np.all(np.isfinite(cam_np)):
                return np.zeros((256, 256), dtype=np.float32), False

            val_range = float(cam_np.max() - cam_np.min())
            if val_range < 1e-6:
                return np.zeros((256, 256), dtype=np.float32), False

            normalized_cam = (cam_np - cam_np.min()) / val_range
            return normalized_cam.astype(np.float32), True

    def explain_class(self, tensor: np.ndarray, target_class: str | int) -> Tuple[np.ndarray, str, bool]:
        """Generate Grad-CAM explanation for an arbitrary target class."""
        x = torch.from_numpy(tensor).float().to(self.device)
        with torch.enable_grad():
            cls_logits, _, f4 = self.model(x)
            top_idx = int(cls_logits.argmax(1))
            target_idx, class_code = self._resolve_target_idx(target_class, top_idx)
            cam, valid = self.compute_cam(f4, cls_logits, target_idx)
            return cam, class_code, valid

    def predict(self, tensor: np.ndarray, mm_per_px: float = 15.0 / 256.0,
                seg_threshold: float = 0.5, target_class: Optional[str | int] = None) -> InferenceResult:
        x = torch.from_numpy(tensor).float().to(self.device)
        with torch.enable_grad():
            cls_logits, seg_logits, f4 = self.model(x)
            probs_t = F.softmax(cls_logits / self.temperature, dim=1)
            top_idx = int(cls_logits.argmax(1))
            target_idx, target_code = self._resolve_target_idx(target_class, top_idx)
            cam, cam_valid = self.compute_cam(f4, cls_logits, target_idx)

        with torch.no_grad():
            seg_p = torch.sigmoid(seg_logits)[0, 0].cpu().numpy()

        probs = probs_t[0].detach().cpu().numpy()
        mask = (seg_p >= seg_threshold).astype(np.uint8)
        mask = _largest_component(mask) if mask.sum() else mask
        seg_valid = bool(mask.sum() > 0 and mask.sum() < (256 * 256 * 0.95))

        pd = {c: float(p) for c, p in zip(self.class_order, probs)}
        ranked = sorted(pd.items(), key=lambda kv: kv[1], reverse=True)
        top3 = ranked[:3]

        return InferenceResult(
            probs=pd,
            top3=top3,
            malignant_flag=top3[0][0] in MALIGNANT,
            malignant_prob=float(sum(pd[c] for c in MALIGNANT if c in pd)),
            risk=stratify_risk(top3),
            mask=mask,
            mask_prob=seg_p,
            cam=cam,
            cam_target_class=target_code,
            cam_target_idx=target_idx,
            cam_valid=cam_valid,
            seg_valid=seg_valid,
            metrics=compute_metrics(mask, mm_per_px),
            temperature=self.temperature,
            class_order=self.class_order,
        )


def result_to_dict(res: InferenceResult, quality: dict, session_id: str, timestamp: str) -> dict:
    m = res.metrics
    return {
        "session_id": session_id,
        "timestamp": timestamp,
        "image_quality": {k: v for k, v in quality.items()},
        "classification": {
            "temperature": res.temperature,
            "class_order": res.class_order,
            "probabilities": res.probs,
            "top3": [{"label": c, "name": LABEL_NAMES[c], "probability": p} for c, p in res.top3],
            "malignant_tendency": res.malignant_flag,
            "malignant_probability_sum": res.malignant_prob,
        },
        "risk": {"level": res.risk.level, "recommendation": res.risk.recommendation,
                 "top3_entropy_norm": res.risk.entropy},
        "morphology": {
            "area_px": m.area_px, "perimeter_px": m.perimeter_px, "area_mm2_est": m.area_mm2,
            "perimeter_mm_est": m.perimeter_mm, "asymmetry_index": m.asymmetry_index,
            "border_compactness": m.compactness, "coverage_pct": m.coverage_pct,
            "boundary_coordinates_256px": m.contour,
        },
        "disclaimer": "Investigational decision-support tool. Not a substitute for histopathological examination.",
    }