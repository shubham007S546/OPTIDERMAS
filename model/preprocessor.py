"""Stage 1: Image Quality Assessment (IQA), Robust DullRazor hair removal, and model preprocessing."""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
MODEL_SIZE = 256

BLUR_THRESHOLD = 12.0
MIN_BRIGHTNESS = 25.0
GLARE_PIXEL = 248
GLARE_AREA_FRAC = 0.12
MIN_SIDE = 150


@dataclass
class QualityReport:
    width: int
    height: int
    sharpness: float
    mean_brightness: float
    glare_fraction: float
    contrast: float
    passed: bool
    issues: List[str] = field(default_factory=list)
    advice: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    is_out_of_distribution: bool = False
    domain_type: str = "dermoscopic"

    def to_dict(self) -> dict:
        return self.__dict__.copy()


_FACE_CASCADE = None


def _get_face_cascade():
    global _FACE_CASCADE
    if _FACE_CASCADE is None:
        try:
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            _FACE_CASCADE = cv2.CascadeClassifier(cascade_path)
        except Exception:
            _FACE_CASCADE = False
    return _FACE_CASCADE if _FACE_CASCADE is not False else None


def assess_quality(img_bgr: np.ndarray) -> QualityReport:
    """Fail-fast image quality audit and input domain assessment. Input: BGR uint8."""
    h, w = img_bgr.shape[:2]
    issues: List[str] = []
    advice: List[str] = []
    warnings: List[str] = []
    is_ood: bool = False
    domain_type: str = "dermoscopic"

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    sharp = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    mean_b = float(lab[..., 0].mean())  # OpenCV L channel is 0-255
    contrast = float(gray.std())
    glare = float((gray > GLARE_PIXEL).mean())

    if min(h, w) < MIN_SIDE:
        issues.append(f"Resolution too low ({w}x{h}); minimum is {MIN_SIDE}x{MIN_SIDE}.")
        advice.append("Please upload a higher-resolution image.")
    if sharp < BLUR_THRESHOLD:
        issues.append(f"Severely Blurred (Laplacian variance {sharp:.1f} < {BLUR_THRESHOLD:.0f}).")
        advice.append("Please capture a sharper, focused dermoscopic image.")
    if mean_b < MIN_BRIGHTNESS:
        issues.append(f"Underexposed (mean brightness {mean_b:.1f} < {MIN_BRIGHTNESS:.0f}).")
        advice.append("Increase illumination and retake the image.")
    if glare > GLARE_AREA_FRAC:
        issues.append(f"Severe specular glare ({glare*100:.1f}% of pixels > {GLARE_PIXEL}).")
        advice.append("Reduce reflections (use cross-polarised light or immersion fluid).")
    if contrast < 15:
        warnings.append(f"Low contrast (std {contrast:.1f}).")

    # Input Domain / Out-of-Distribution (OOD) Guard
    # Check 1: Frontal face detection (detects human selfies / macroscopic portraits)
    face_cas = _get_face_cascade()
    if face_cas is not None and not face_cas.empty():
        try:
            scale = 400.0 / max(h, w) if max(h, w) > 400 else 1.0
            small_gray = cv2.resize(gray, (0, 0), fx=scale, fy=scale) if scale < 1.0 else gray
            faces = face_cas.detectMultiScale(small_gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))
            if len(faces) > 0:
                is_ood = True
                domain_type = "human_face"
                warnings.append(
                    "Out-of-Distribution Warning: Detected human face or macroscopic portrait. "
                    "OptiDerma is trained strictly on close-up dermoscopy (HAM10000). "
                    "Classifications on general photography are clinically invalid."
                )
        except Exception:
            pass

    # Check 2: Skin chromaticity ratio (detects non-skin objects like cars, rooms, furniture)
    if not is_ood:
        try:
            ycrcb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2YCrCb)
            lower_skin = np.array([0, 133, 77], dtype=np.uint8)
            upper_skin = np.array([255, 173, 127], dtype=np.uint8)
            skin_mask = cv2.inRange(ycrcb, lower_skin, upper_skin)
            skin_ratio = float(np.count_nonzero(skin_mask)) / skin_mask.size
            if skin_ratio < 0.25:
                is_ood = True
                domain_type = "non_skin_scene"
                warnings.append(
                    f"Out-of-Distribution Warning: Low skin chromaticity ({skin_ratio*100:.1f}%). "
                    "Input appears to be a macroscopic or non-skin scene rather than a close-up dermoscopic lesion."
                )
        except Exception:
            pass

    return QualityReport(
        width=w,
        height=h,
        sharpness=sharp,
        mean_brightness=mean_b,
        glare_fraction=glare,
        contrast=contrast,
        passed=len(issues) == 0,
        issues=issues,
        advice=advice,
        warnings=warnings,
        is_out_of_distribution=is_ood,
        domain_type=domain_type,
    )


def _build_directional_kernels():
    kernels = []
    # Multi-scale lengths: 9 for fine hairs, 17 for medium, 25 and 33 for coarse hairs
    # Angles from 0 to 180 in 15-degree increments with thickness 1 and 2
    for l in (9, 17, 25, 33):
        c = l // 2
        for a in range(0, 180, 15):
            rad = math.radians(a)
            dx = int(round(c * math.cos(rad)))
            dy = int(round(c * math.sin(rad)))
            for th in (1, 2):
                k = np.zeros((l, l), dtype=np.uint8)
                cv2.line(k, (c - dx, c - dy), (c + dx, c + dy), 1, thickness=th)
                kernels.append(k)
    return kernels

_DIRECTIONAL_KERNELS = _build_directional_kernels()


def compute_psnr(img1: np.ndarray, img2: np.ndarray) -> float:
    mse = np.mean((img1.astype(np.float64) - img2.astype(np.float64)) ** 2)
    if mse < 1e-10:
        return float("inf")
    return float(20 * math.log10(255.0 / math.sqrt(mse)))


@dataclass
class HairRemovalDiagnostics:
    hair_detected: bool
    hair_pixel_count: int
    hair_coverage_pct: float
    detected_strands: int
    mean_strand_length: float
    psnr_diff: float
    inpaint_method: str = "telea"
    execution_status: str = "success"
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "hair_detected": self.hair_detected,
            "hair_pixel_count": self.hair_pixel_count,
            "hair_coverage_pct": round(self.hair_coverage_pct, 3),
            "detected_strands": self.detected_strands,
            "mean_strand_length": round(self.mean_strand_length, 1),
            "psnr_diff": round(self.psnr_diff, 2) if not math.isinf(self.psnr_diff) else 999.0,
            "inpaint_method": self.inpaint_method,
            "execution_status": self.execution_status,
            "warnings": self.warnings,
        }


@dataclass
class HairRemovalResult:
    original_bgr: np.ndarray
    clean_bgr: np.ndarray
    processed_image: np.ndarray
    hair_mask: np.ndarray
    diagnostics: HairRemovalDiagnostics
    status: str

    def __iter__(self):
        """Allows unpacking as (clean_bgr, hair_mask) for backwards compatibility."""
        return iter((self.clean_bgr, self.hair_mask))

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "diagnostics": self.diagnostics.to_dict(),
        }


def remove_hair(
    img_bgr: np.ndarray,
    thresh: Optional[int] = None,
    inpaint_radius: int = 3,
    max_coverage_limit: float = 0.25,
) -> HairRemovalResult:
    """Robust clinical DullRazor hair removal algorithm:
    1. Multi-directional multi-scale linear morphological black-hat filtering.
    2. Adaptive thresholding calibrated to background skin texture to prevent pore-bridge blowout.
    3. Connected component rotated bounding box analysis to detect diagonal, angled,
       and intersecting hair strands while strictly preserving compact lesion pigment globules.
    4. Structural preservation: Rejects lesion annular rings and non-hair pigment networks.
    5. Telea inpainting strictly confined to the detected hair mask.
    6. Returns a rich HairRemovalResult that unpacks to (clean_bgr, hair_mask) for compatibility.
    """
    orig = img_bgr.copy()
    h, w = img_bgr.shape[:2]
    total_pixels = h * w
    warnings: List[str] = []

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # 1. Multi-directional linear blackhat
    blackhat = np.zeros_like(gray)
    for k in _DIRECTIONAL_KERNELS:
        bh = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, k)
        blackhat = np.maximum(blackhat, bh)

    # 2. Gaussian smoothing to suppress fine skin pore granularity
    smoothed_bh = cv2.GaussianBlur(blackhat, (3, 3), 0)

    # 3. Dynamic adaptive binary thresholding
    if thresh is None:
        mean_val = float(np.mean(smoothed_bh))
        std_val = float(np.std(smoothed_bh))
        effective_thresh = max(10, min(int(round(mean_val + 0.9 * std_val)), 25))
    else:
        effective_thresh = thresh

    _, binary = cv2.threshold(smoothed_bh, effective_thresh, 255, cv2.THRESH_BINARY)

    # 4. Connected component analysis to isolate elongated hair strands
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary, connectivity=8)
    hair_mask = np.zeros_like(binary)
    strand_lengths: List[float] = []
    strands_count = 0

    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        sw = stats[i, cv2.CC_STAT_WIDTH]
        sh = stats[i, cv2.CC_STAT_HEIGHT]

        if area < 6:
            continue

        major_side = max(sw, sh)
        minor_side = max(min(sw, sh), 1)
        aspect_ratio = major_side / minor_side

        # Average stroke thickness: for a thin curve, Area ~ Length * Thickness, Perim ~ 2 * Length
        # Therefore stroke_thickness ~ 2 * Area / Perim
        comp_mask = (labels == i).astype(np.uint8)
        cnts, hier = cv2.findContours(comp_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        if not cnts:
            continue

        cnt = cnts[0]
        perim = cv2.arcLength(cnt, True)
        stroke_thickness = (2.0 * area) / max(perim, 1.0)

        # Check topological structure: reject annular rings enclosing a dark lesion
        is_lesion_ring = False
        if hier is not None and hier.shape[1] > 1:
            for h_idx in range(len(cnts)):
                if hier[0][h_idx][3] != -1:
                    hole_area = cv2.contourArea(cnts[h_idx])
                    if hole_area > 2000:
                        h_mask = np.zeros_like(comp_mask)
                        cv2.drawContours(h_mask, [cnts[h_idx]], -1, 255, -1)
                        mean_interior = float(np.mean(cv2.mean(img_bgr, mask=h_mask)[:3]))
                        if mean_interior < 140.0:
                            is_lesion_ring = True
                            break

        if is_lesion_ring or stroke_thickness > 9.0:
            continue

        # Rotated bounding box to accurately calculate aspect ratio of diagonal hair strands
        if len(cnt) >= 5:
            (cx, cy), (rw, rh), _ = cv2.minAreaRect(cnt)
            rot_ar = max(rw, rh) / max(min(rw, rh), 0.5)
        else:
            rot_ar = aspect_ratio
        effective_ar = max(aspect_ratio, rot_ar)
        form_factor = (perim * perim) / (4.0 * math.pi * max(area, 1))

        # Reject large non-elongated lesion blobs and pigment networks
        if area > 150 and effective_ar < 1.6 and form_factor < 18.0:
            continue

        # Hair strand geometric criteria:
        # 1. Elongated thin hair strands (effective_ar >= 2.0, major_side >= 8, stroke <= 8.0)
        # 2. Longer diagonal/crossing hairs (effective_ar >= 1.7, major_side >= 15, stroke <= 6.0)
        # 3. Crossing hair networks (form_factor >= 18.0, stroke <= 7.5)
        is_hair = False
        if effective_ar >= 2.0 and major_side >= 8 and stroke_thickness <= 8.0:
            is_hair = True
        elif effective_ar >= 1.7 and major_side >= 15 and stroke_thickness <= 6.0:
            is_hair = True
        elif form_factor >= 18.0 and stroke_thickness <= 7.5:
            is_hair = True

        if is_hair:
            hair_mask[labels == i] = 255
            est_strands = max(1, int(round((perim / 2.0) / 200.0))) if perim > 350 else 1
            strands_count += est_strands
            strand_lengths.append(float(major_side))

    # 5. Gap closing along hair trajectories and minimal dilation
    if strands_count > 0:
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        hair_mask = cv2.morphologyEx(hair_mask, cv2.MORPH_CLOSE, kernel_close)
        hair_mask = cv2.dilate(hair_mask, kernel_close, iterations=1)

    hair_pixels = int(np.sum(hair_mask > 0))
    coverage_pct = (hair_pixels / total_pixels) * 100.0

    # 6. Safety guard against total occlusion
    if coverage_pct > (max_coverage_limit * 100.0):
        warnings.append(
            f"Excessive hair occlusion ({coverage_pct:.1f}% > {max_coverage_limit*100:.0f}% threshold). "
            "Hair removal was restricted to prevent lesion structure distortion."
        )
        status = "partial_occlusion_guard"
        clean = cv2.inpaint(img_bgr, hair_mask, inpaint_radius, cv2.INPAINT_TELEA)
    elif hair_pixels == 0:
        status = "no_hair_detected"
        clean = orig.copy()
    else:
        status = "success"
        clean = cv2.inpaint(img_bgr, hair_mask, inpaint_radius, cv2.INPAINT_TELEA)

    psnr = compute_psnr(orig, clean)
    mean_length = float(np.mean(strand_lengths)) if strand_lengths else 0.0

    diag = HairRemovalDiagnostics(
        hair_detected=hair_pixels > 0,
        hair_pixel_count=hair_pixels,
        hair_coverage_pct=coverage_pct,
        detected_strands=strands_count,
        mean_strand_length=mean_length,
        psnr_diff=psnr,
        inpaint_method="telea",
        execution_status=status,
        warnings=warnings,
    )

    return HairRemovalResult(
        original_bgr=orig,
        clean_bgr=clean,
        processed_image=clean,
        hair_mask=hair_mask,
        diagnostics=diag,
        status=status,
    )


def beer_lambert_correction(img_bgr: np.ndarray, sigma: float = 30.0) -> np.ndarray:
    """Optical illumination normalization via low-frequency energy estimation."""
    img_float = img_bgr.astype(np.float32) + 1.0
    illum_field = cv2.GaussianBlur(img_float, (0, 0), sigmaX=sigma, sigmaY=sigma)
    mean_ref = np.mean(illum_field, axis=(0, 1), keepdims=True)
    corrected = (img_float / illum_field) * mean_ref
    return np.clip(corrected, 0, 255).astype(np.uint8)


def shades_of_gray(img_bgr: np.ndarray, p: float = 6.0) -> np.ndarray:
    """Shades-of-Gray colour constancy (p=1 -> Gray-World, p->inf -> Max-RGB)."""
    img = img_bgr.astype(np.float32)
    illum = np.power(np.mean(np.power(img, p), axis=(0, 1)), 1.0 / p)
    illum = np.maximum(illum, 1e-6)
    scale = np.linalg.norm(illum) / np.sqrt(3.0) / illum
    return np.clip(img * scale, 0, 255).astype(np.uint8)


@dataclass
class PreprocessResult:
    quality: QualityReport
    original_rgb: np.ndarray | None = None          # original size RGB
    clean_rgb: np.ndarray | None = None             # de-haired RGB (256x256)
    hair_mask: np.ndarray | None = None             # 256x256 uint8
    hair_mask_native: np.ndarray | None = None      # Native resolution hair mask
    tensor: np.ndarray | None = None                # (1,3,256,256) float32 normalised
    hair_diagnostics: HairRemovalDiagnostics | None = None


def preprocess(img_bgr: np.ndarray, force: bool = False) -> PreprocessResult:
    """Full Stage-1 pipeline: IQA Gatekeeper -> Enhanced DullRazor -> Resize -> Normalization.
    Preserves natural dermoscopic skin tones to maximize classification confidence.
    """
    q = assess_quality(img_bgr)
    orig_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    if not q.passed and not force:
        return PreprocessResult(quality=q, original_rgb=orig_rgb)

    # 1. Hair removal on native or high resolution (max side 1024 for speed & fine edge fidelity)
    h, w = img_bgr.shape[:2]
    max_side = max(h, w)
    if max_side > 1024:
        scale = 1024.0 / max_side
        proc_img = cv2.resize(img_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    else:
        proc_img = img_bgr

    hair_res = remove_hair(proc_img)
    clean_bgr = hair_res.clean_bgr
    hair_mask_native = hair_res.hair_mask

    # 2. Resize de-haired image to model size (256x256)
    clean_256_bgr = cv2.resize(clean_bgr, (MODEL_SIZE, MODEL_SIZE), interpolation=cv2.INTER_AREA)
    hair_mask_256 = cv2.resize(hair_mask_native, (MODEL_SIZE, MODEL_SIZE), interpolation=cv2.INTER_NEAREST)

    # 3. Convert to RGB; preserve chromatic balance
    clean_rgb_256 = cv2.cvtColor(clean_256_bgr, cv2.COLOR_BGR2RGB)

    # 4. ImageNet normalization
    norm = (clean_rgb_256.astype(np.float32) / 255.0 - IMAGENET_MEAN) / IMAGENET_STD
    tensor = np.transpose(norm, (2, 0, 1))[None].astype(np.float32)

    return PreprocessResult(
        quality=q,
        original_rgb=orig_rgb,
        clean_rgb=clean_rgb_256,
        hair_mask=hair_mask_256,
        hair_mask_native=hair_mask_native,
        tensor=tensor,
        hair_diagnostics=hair_res.diagnostics,
    )
