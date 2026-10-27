"""OptiDerma PyTorch model inference service.

Provides loaded OptiDermaPipeline with:
- DullRazor hair removal and diagnostic hair mask
- Grad-CAM attention overlays with selectable target class
- Real U-Net segmentation mask and morphometrics
- In-memory canonical analysis repository (ANALYSIS_STORE)
"""

from __future__ import annotations

import base64
import hashlib
import os
import sys
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
from fastapi import HTTPException

# Ensure model directory is in sys.path
MODEL_DIR = Path(__file__).resolve().parent.parent.parent.parent / "model"
if str(MODEL_DIR) not in sys.path:
    sys.path.insert(0, str(MODEL_DIR))

from model_pipeline import OptiDermaPipeline, blend_cam, blend_mask, draw_contour, render_raw_cam
from preprocessor import preprocess
from app.rag.dermatology_rag import dermatology_rag
from app.safety.safety_checker import SafetyChecker
from app.services.verification_service import verification_service
from app.services.persistence_service import PersistenceService
from app.services.report_service import compute_differential_reporting_strategy
from app.utils.logger import logger

MAX_BYTES = 20 * 1024 * 1024
DEFAULT_FOV_MM = 15.0
WEIGHTS_PATH = os.environ.get(
    "OPTIDERMA_WEIGHTS", str(MODEL_DIR / "optiderma_best_model.pth")
)

_pipeline: Optional[OptiDermaPipeline] = None
_infer_lock = threading.Lock()
safety_checker = SafetyChecker()

# Canonical Analysis Storage for Session Retention & Voice Context
ANALYSIS_STORE: Dict[str, Dict[str, Any]] = {}
_SESSION_TENSORS: Dict[str, np.ndarray] = {}
_SESSION_DISPLAYS: Dict[str, np.ndarray] = {}
_SESSION_MASKS: Dict[str, np.ndarray] = {}


def get_inference_pipeline() -> OptiDermaPipeline:
    """Lazily load and return the shared OptiDermaPipeline instance."""
    global _pipeline
    if _pipeline is None:
        with _infer_lock:
            if _pipeline is None:
                import gc
                logger.info(f"Initializing OptiDerma pipeline with target path: {WEIGHTS_PATH}")
                _pipeline = OptiDermaPipeline(WEIGHTS_PATH)
                gc.collect()
                logger.info("OptiDerma pipeline successfully initialized.")
    return _pipeline


def is_model_ready() -> bool:
    """Check whether model pipeline can be loaded without errors."""
    try:
        p = get_inference_pipeline()
        return p is not None
    except Exception as exc:
        logger.warning(f"Model readiness check failed: {exc}")
        return False


def _data_url(rgb: np.ndarray, size: int = 512) -> str:
    """Encode an RGB array as a JPEG data URL."""
    if rgb.shape[0] != size or rgb.shape[1] != size:
        rgb = cv2.resize(rgb, (size, size), interpolation=cv2.INTER_CUBIC)
    ok, buf = cv2.imencode(".jpg", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ok:
        raise RuntimeError("JPEG encoding failed")
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")


def _mask_data_url(mask: np.ndarray, size: int = 512) -> str:
    """Encode a binary mask (0/255) as a PNG data URL."""
    if mask.shape[0] != size or mask.shape[1] != size:
        mask = cv2.resize(mask, (size, size), interpolation=cv2.INTER_NEAREST)
    ok, buf = cv2.imencode(".png", mask)
    if not ok:
        raise RuntimeError("PNG encoding failed")
    return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode("ascii")


def run_prediction(
    image_bytes: bytes,
    force: bool = False,
    fov_mm: float = DEFAULT_FOV_MM,
    target_class: Optional[str] = None,
    user_query: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute complete end-to-end decision-support pipeline:
    IQA -> DullRazor -> PyTorch Multi-Task -> Grad-CAM -> Verification -> RAG.
    Returns complete canonical record adhering to PredictResponseSchema.
    """
    if len(image_bytes) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the 20 MB limit")

    img_bgr = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Could not decode the image file. Ensure JPG, PNG, or WEBP.")

    pre = preprocess(img_bgr, force=force)
    if pre.tensor is None:
        q = pre.quality
        raise HTTPException(
            status_code=400,
            detail="Image quality check failed: " + " ".join(q.issues + q.advice),
        )

    pipeline = get_inference_pipeline()
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model is still initializing")

    try:
        with _infer_lock:
            res = pipeline.predict(pre.tensor, mm_per_px=fov_mm / 256.0, target_class=target_class)
    except Exception as exc:
        logger.error(f"Inference execution failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}") from exc

    m = res.metrics
    original_256 = cv2.resize(pre.original_rgb, (256, 256), interpolation=cv2.INTER_AREA)
    display_rgb = pre.clean_rgb if pre.clean_rgb is not None else original_256

    try:
        mask_overlay_url = _data_url(blend_mask(display_rgb, res.mask, 0.4))
    except Exception as exc:
        logger.warning(f"mask overlay generation failed: {exc}")
        mask_overlay_url = _data_url(original_256)

    try:
        cam_overlay_url = _data_url(blend_cam(display_rgb, res.cam))
    except Exception as exc:
        logger.warning(f"CAM overlay generation failed: {exc}")
        cam_overlay_url = _data_url(original_256)

    # Multi-view XAI & Segmentation renderings
    try:
        raw_cam_rgb = render_raw_cam(res.cam)
        raw_cam_url = _data_url(raw_cam_rgb)
    except Exception:
        raw_cam_url = cam_overlay_url

    try:
        seg_mask_url = _mask_data_url(res.mask)
    except Exception:
        seg_mask_url = ""

    try:
        contour_rgb = draw_contour(original_256, res.mask, (0, 255, 0))
        mask_contour_url = _data_url(contour_rgb)
    except Exception:
        mask_contour_url = mask_overlay_url

    try:
        cam_on_clean_url = _data_url(blend_cam(display_rgb, res.cam))
    except Exception:
        cam_on_clean_url = cam_overlay_url

    hair_mask_url = ""
    if pre.hair_mask is not None:
        try:
            hair_mask_url = _mask_data_url(pre.hair_mask)
        except Exception:
            pass

    analysis_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    hair_diag = pre.hair_diagnostics.to_dict() if pre.hair_diagnostics else {}
    quality_dict = pre.quality.to_dict() if pre.quality else {}

    # Safety check on optional query
    safety_eval = safety_checker.evaluate(user_query or "") if user_query else None
    safety_dict = safety_eval.__dict__ if safety_eval else None

    # Retrieve grounded clinical evidence matching top-3 conditions
    top_codes = [c for c, _ in res.top3]
    evidence_passages = dermatology_rag.retrieve_evidence(
        query=user_query or f"Dermoscopy evaluation for {top_codes[0]}",
        condition_codes=top_codes,
        top_k=2,
    )

    # Compute Spatial XAI Diagnostics (localization energy & bleed analysis)
    cam_sum = float(np.sum(res.cam))
    mask_bool = res.mask.astype(bool)
    energy_inside = float(np.sum(res.cam[mask_bool])) / max(cam_sum, 1e-6)
    mean_inside = float(np.mean(res.cam[mask_bool])) if np.any(mask_bool) else 0.0
    mean_outside = float(np.mean(res.cam[~mask_bool])) if np.any(~mask_bool) else 0.0
    spatial_ratio = mean_inside / max(mean_outside, 1e-6)

    xai_warnings: List[str] = []
    if energy_inside < 0.40:
        xai_warnings.append(
            f"Attribution bleed: Only {energy_inside*100:.1f}% of saliency energy is localized within the lesion boundary. High background activation observed."
        )
    if float(res.cam.std()) < 0.05:
        xai_warnings.append(
            "Low contrast attribution: Feature map activation is nearly uniform across the field-of-view."
        )
    if not res.cam_valid:
        xai_warnings.append("Degenerate Grad-CAM: Gradients produced vanishing activation range (< 1e-6).")

    xai_diagnostics = {
        "target_class": res.cam_target_class,
        "target_idx": res.cam_target_idx,
        "target_logit": float(res.probs.get(res.cam_target_class, 0.0)),
        "target_prob": float(res.probs.get(res.cam_target_class, 0.0)),
        "energy_inside_pct": round(energy_inside * 100, 1),
        "mean_attribution_inside": round(mean_inside, 3),
        "mean_attribution_outside": round(mean_outside, 3),
        "spatial_ratio": round(spatial_ratio, 2),
        "target_layer": "encoder._conv_head (f4, 448ch, 8x8)",
        "checkpoint_hash": "006a77b02a",
        "image_fingerprint": hashlib.sha256(image_bytes).hexdigest(),
        "warnings": xai_warnings,
    }

    raw_response = {
        "analysis_id": analysis_id,
        "created_at": created_at,
        "probs": res.probs,
        "top3": [[c, p] for c, p in res.top3],
        "differential_strategy": compute_differential_reporting_strategy([[c, p] for c, p in res.top3]),
        "malignant_flag": res.malignant_flag,
        "malignant_prob": res.malignant_prob,
        "risk": {
            "level": res.risk.level,
            "color": res.risk.color,
            "recommendation": res.risk.recommendation,
        },
        "metrics": {
            "area_px": m.area_px,
            "perimeter_px": m.perimeter_px,
            "area_mm2": m.area_mm2,
            "perimeter_mm": m.perimeter_mm,
            "is_calibrated": False,
            "calibration_method": "uncalibrated_pixel_space",
            "calibration_disclaimer": "Physical dimensions (mm, mm²) assume an uncalibrated 15mm dermoscopic contact plate; no optical reticle was detected.",
            "asymmetry_index": m.asymmetry_index,
            "compactness": m.compactness,
            "coverage_pct": m.coverage_pct,
            "contour": m.contour,
        },
        "images": {
            "original": _data_url(original_256),
            "clean": _data_url(display_rgb),
            "mask_overlay": mask_overlay_url,
            "cam_overlay": cam_overlay_url,
            "hair_mask": hair_mask_url,
            "raw_cam": raw_cam_url,
            "seg_mask": seg_mask_url,
            "mask_contour": mask_contour_url,
            "cam_on_clean": cam_on_clean_url,
        },
        "hair_removal": hair_diag,
        "quality": quality_dict,
        "cam_target_class": res.cam_target_class,
        "cam_valid": res.cam_valid,
        "seg_valid": res.seg_valid,
        "xai": xai_diagnostics,
        "evidence": [p.model_dump() for p in evidence_passages],
    }

    # Execute Independent Deterministic Verification
    verif = verification_service.verify_analysis(
        analysis_data=raw_response,
        quality_data=quality_dict,
        safety_data=safety_dict,
    )
    raw_response["verification"] = verif.to_dict()

    # Execute Multi-Agent Clinical Council Deliberation (Triage, Vision, Critic, Evidence, Care, Communication)
    try:
        from app.agents.council import clinical_council
        council_consensus = clinical_council.deliberate(
            analysis_record=raw_response,
            query=user_query,
            symptoms={"query": user_query} if user_query else None,
        )
        raw_response["council"] = council_consensus.model_dump()
    except Exception as exc:
        logger.warning(f"Clinical council deliberation exception: {exc}")
        raw_response["council"] = None

    # Generate Empathetic Plain-Language Patient Care Summary (GenAI / Literature)
    try:
        from app.services.patient_care_service import generate_patient_care_summary
        raw_response["patient_summary"] = generate_patient_care_summary(raw_response, user_query)
    except Exception as exc:
        logger.warning(f"Patient care summary generation exception: {exc}")
        raw_response["patient_summary"] = None

    # Persist in Canonical Analysis Store & Active Session Tensors (capped at 5 to keep RAM under 450MB)
    MAX_SESSION_CACHE = 5
    if len(_SESSION_TENSORS) >= MAX_SESSION_CACHE:
        oldest_k = next(iter(_SESSION_TENSORS))
        _SESSION_TENSORS.pop(oldest_k, None)
        _SESSION_DISPLAYS.pop(oldest_k, None)
        _SESSION_MASKS.pop(oldest_k, None)
        ANALYSIS_STORE.pop(oldest_k, None)

    ANALYSIS_STORE[analysis_id] = raw_response
    _SESSION_TENSORS[analysis_id] = pre.tensor
    _SESSION_DISPLAYS[analysis_id] = display_rgb
    _SESSION_MASKS[analysis_id] = res.mask

    # Dual-tier durable persistence (Supabase Cloud + Local SQLite Store)
    persist_info = PersistenceService.save_analysis(raw_response, raw_response.get("images"))
    raw_response["persistence"] = persist_info

    import gc
    gc.collect()

    return raw_response


def _rehydrate_session_if_needed(analysis_id: str):
    """Rehydrates inference tensor session from persistent store after backend restart."""
    if analysis_id in _SESSION_TENSORS and analysis_id in _SESSION_DISPLAYS:
        return
    record = PersistenceService.get_analysis(analysis_id)
    if not record:
        return
    images = record.get("images", {})
    target_url = images.get("original") or images.get("clean")
    if not target_url or "," not in target_url:
        return
    try:
        b64_data = target_url.split(",", 1)[1]
        raw_bytes = base64.b64decode(b64_data)
        img_bgr = cv2.imdecode(np.frombuffer(raw_bytes, np.uint8), cv2.IMREAD_COLOR)
        if img_bgr is None:
            return
        pre = preprocess(img_bgr, force=True)
        pipeline = get_inference_pipeline()
        if pipeline is None or pre.tensor is None:
            return
        res = pipeline.predict(pre.tensor)
        display_rgb = pre.clean_rgb if pre.clean_rgb is not None else cv2.resize(pre.original_rgb, (256, 256))
        ANALYSIS_STORE[analysis_id] = record
        _SESSION_TENSORS[analysis_id] = pre.tensor
        _SESSION_DISPLAYS[analysis_id] = display_rgb
        _SESSION_MASKS[analysis_id] = res.mask
        logger.info("Successfully rehydrated inference tensors for %s from persistent store.", analysis_id)
    except Exception as e:
        logger.warning("Could not rehydrate session tensors for %s: %s", analysis_id, e)


def recompute_xai_for_class(analysis_id: str, target_class: str) -> Dict[str, Any]:
    """Dynamically recompute class-specific Grad-CAM attributions and spatial energy diagnostics."""
    _rehydrate_session_if_needed(analysis_id)

    record = PersistenceService.get_analysis(analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Analysis ID '{analysis_id}' not found.")

    tensor = _SESSION_TENSORS.get(analysis_id)
    if tensor is None:
        raise HTTPException(
            status_code=410,
            detail="Inference tensor session expired or unavailable for this record."
        )

    pipeline = get_inference_pipeline()
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model pipeline unavailable.")

    # Multi-class comparison mode (View F)
    if target_class == "compare":
        top3_codes = [c for c, _ in record.get("top3", [])]
        comparison_results = {}
        display_rgb = _SESSION_DISPLAYS.get(analysis_id)
        mask = _SESSION_MASKS.get(analysis_id, np.zeros((256, 256), dtype=np.uint8))
        mask_bool = mask.astype(bool)

        for code in top3_codes:
            with _infer_lock:
                cam, class_code, cam_valid = pipeline.explain_class(tensor, code)

            cam_sum = float(np.sum(cam))
            energy_inside = float(np.sum(cam[mask_bool])) / max(cam_sum, 1e-6)
            mean_inside = float(np.mean(cam[mask_bool])) if np.any(mask_bool) else 0.0
            mean_outside = float(np.mean(cam[~mask_bool])) if np.any(~mask_bool) else 0.0

            raw_cam_rgb = render_raw_cam(cam)
            cam_overlay_rgb = blend_cam(display_rgb, cam)

            comparison_results[code] = {
                "class_code": code,
                "cam_valid": cam_valid,
                "raw_cam": _data_url(raw_cam_rgb),
                "cam_overlay": _data_url(cam_overlay_rgb),
                "energy_inside_pct": round(energy_inside * 100, 1),
                "mean_attribution_inside": round(mean_inside, 3),
                "mean_attribution_outside": round(mean_outside, 3),
            }

        return {
            "analysis_id": analysis_id,
            "mode": "comparison",
            "comparison": comparison_results,
            "classes": comparison_results,
        }

    # Single class dynamic attribution (Views B, C, E)
    with _infer_lock:
        cam, class_code, cam_valid = pipeline.explain_class(tensor, target_class)

    display_rgb = _SESSION_DISPLAYS.get(analysis_id)
    raw_cam_rgb = render_raw_cam(cam)
    cam_overlay_rgb = blend_cam(display_rgb, cam)
    mask = _SESSION_MASKS.get(analysis_id, np.zeros((256, 256), dtype=np.uint8))

    cam_sum = float(np.sum(cam))
    mask_bool = mask.astype(bool)
    energy_inside = float(np.sum(cam[mask_bool])) / max(cam_sum, 1e-6)
    mean_inside = float(np.mean(cam[mask_bool])) if np.any(mask_bool) else 0.0
    mean_outside = float(np.mean(cam[~mask_bool])) if np.any(~mask_bool) else 0.0
    spatial_ratio = mean_inside / max(mean_outside, 1e-6)

    warnings: List[str] = []
    if energy_inside < 0.40:
        warnings.append(
            f"Attribution bleed: Only {energy_inside*100:.1f}% of saliency energy is localized within the lesion boundary."
        )

    diag = {
        "energy_inside_pct": round(energy_inside * 100, 1),
        "mean_attribution_inside": round(mean_inside, 3),
        "mean_attribution_outside": round(mean_outside, 3),
        "spatial_ratio": round(spatial_ratio, 2),
        "warnings": warnings,
    }

    return {
        "analysis_id": analysis_id,
        "target_class": class_code,
        "cam_valid": cam_valid,
        "raw_cam": _data_url(raw_cam_rgb),
        "cam_overlay": _data_url(cam_overlay_rgb),
        "cam": _data_url(cam_overlay_rgb),
        "diagnostics": diag,
        "energy_inside_pct": diag["energy_inside_pct"],
        "mean_attribution_inside": diag["mean_attribution_inside"],
        "mean_attribution_outside": diag["mean_attribution_outside"],
        "spatial_ratio": diag["spatial_ratio"],
        "warnings": warnings,
    }
