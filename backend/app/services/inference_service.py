"""OptiDerma PyTorch model inference service.

Provides loaded OptiDermaPipeline with Grad-CAM and morphology metrics.
"""

from __future__ import annotations

import base64
import os
import sys
import threading
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import HTTPException

# Ensure model directory is in sys.path
MODEL_DIR = Path(__file__).resolve().parent.parent.parent.parent / "model"
if str(MODEL_DIR) not in sys.path:
    sys.path.insert(0, str(MODEL_DIR))

from model_pipeline import OptiDermaPipeline, blend_cam, blend_mask
from preprocessor import preprocess
from app.utils.logger import logger

MAX_BYTES = 20 * 1024 * 1024
DEFAULT_FOV_MM = 15.0
WEIGHTS_PATH = os.environ.get(
    "OPTIDERMA_WEIGHTS", str(MODEL_DIR / "optiderma_best_model.pth")
)

_pipeline: Optional[OptiDermaPipeline] = None
_infer_lock = threading.Lock()


def get_inference_pipeline() -> OptiDermaPipeline:
    """Lazily load and return the OptiDermaPipeline instance."""
    global _pipeline
    if _pipeline is None:
        with _infer_lock:
            if _pipeline is None:
                logger.info(f"Loading OptiDerma weights from: {WEIGHTS_PATH}")
                _pipeline = OptiDermaPipeline(WEIGHTS_PATH)
                logger.info("OptiDerma weights successfully loaded into memory.")
    return _pipeline


def _data_url(rgb: np.ndarray, size: int = 512) -> str:
    """Encode an RGB array as a JPEG data URL (upscaled for display)."""
    if rgb.shape[0] != size:
        rgb = cv2.resize(rgb, (size, size), interpolation=cv2.INTER_CUBIC)
    ok, buf = cv2.imencode(".jpg", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ok:
        raise RuntimeError("JPEG encoding failed")
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")


def run_prediction(
    image_bytes: bytes,
    force: bool = False,
    fov_mm: float = DEFAULT_FOV_MM,
) -> dict:
    """Run preprocessing, multi-task inference, Grad-CAM, and morphology metrics.
    
    Returns a dict adhering to PredictResponseSchema.
    """
    if len(image_bytes) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the 20 MB limit")

    img_bgr = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Could not decode the image file")

    pre = preprocess(img_bgr, force=force)
    if pre.tensor is None:
        q = pre.quality
        raise HTTPException(
            status_code=400,
            detail="Image quality check failed: " + " ".join(q.issues + q.advice),
        )

    pipeline = get_inference_pipeline()
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model is still loading")

    try:
        with _infer_lock:
            res = pipeline.predict(pre.tensor, mm_per_px=fov_mm / 256.0)
    except Exception as exc:
        logger.error(f"Inference execution failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}") from exc

    m = res.metrics
    original_256 = cv2.resize(pre.original_rgb, (256, 256), interpolation=cv2.INTER_AREA)

    # Use clean_rgb if available; fall back to original for overlay generation
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

    return {
        "probs": res.probs,
        "top3": [[c, p] for c, p in res.top3],
        "malignant_flag": res.malignant_flag,
        "malignant_prob": res.malignant_prob,
        "risk": {
            "level": res.risk.level,
            "color": res.risk.color,
            "recommendation": res.risk.recommendation,
        },
        "metrics": {
            "area_mm2": m.area_mm2,
            "perimeter_mm": m.perimeter_mm,
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
        },
    }
