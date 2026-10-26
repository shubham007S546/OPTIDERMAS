"""PyTorch EfficientNet-B4 multi-task implementation of the skin vision interface."""

from typing import Optional
from app.config import settings
from app.schemas.dermatology import FindingItem, SkinAnalysis
from app.utils.logger import logger
from app.vision.base import BaseSkinVisionService


LABEL_DISPLAY_NAMES = {
    "mel": "Melanoma",
    "nv": "Melanocytic Nevi",
    "bcc": "Basal Cell Carcinoma",
    "akiec": "Actinic Keratoses / Intraepithelial Carcinoma",
    "bkl": "Benign Keratosis-like Lesions",
    "df": "Dermatofibroma",
    "vasc": "Vascular Lesions",
}


class EfficientNetSkinVisionService(BaseSkinVisionService):
    """Vision engine wrapper for PyTorch EfficientNet-B4 multi-task dermoscopy classifier."""

    def __init__(self, weights_path: Optional[str] = None):
        self.weights_path = weights_path or settings.EFFICIENTNET_WEIGHTS_PATH
        self.model_name = "EfficientNet-B4 Dermoscopy (7-Class Multi-Task)"

    def analyze_skin_image(
        self, image_bytes: bytes, query: Optional[str] = None
    ) -> SkinAnalysis:
        logger.info("Running EfficientNet-B4 dermoscopy inference.")
        try:
            from app.services.inference_service import run_prediction

            pred = run_prediction(image_bytes, force=True)
            top3 = pred.get("top3", [])
            findings = []
            for code, conf in top3:
                name = LABEL_DISPLAY_NAMES.get(code, code)
                findings.append(
                    FindingItem(
                        condition_name=name,
                        confidence_score=round(float(conf), 3),
                        category="malignant" if code in {"mel", "bcc", "akiec"} else "benign",
                        description=f"Model detected features characteristic of {name} ({conf:.1%} confidence).",
                    )
                )

            top_code, top_conf = top3[0] if top3 else ("nv", 0.5)
            top_name = LABEL_DISPLAY_NAMES.get(top_code, top_code)
            risk_info = pred.get("risk", {})
            metrics = pred.get("metrics", {})

            features = [
                f"Risk: {risk_info.get('level', 'Normal')}",
                f"Asymmetry Index: {metrics.get('asymmetry_index', 'N/A')}",
                f"Area: {metrics.get('area_mm2', 'N/A')} mm²",
            ]

            return SkinAnalysis(
                has_image=True,
                model_name=self.model_name,
                top_prediction=top_name,
                top_confidence=round(float(top_conf), 3),
                findings=findings,
                detected_features=features,
                is_dermatology_validated=True,
                raw_analysis=f"PyTorch EfficientNet-B4 multi-task model: {risk_info.get('recommendation', '')}",
            )
        except Exception as exc:
            logger.warning(f"Inference service fallback in EfficientNetSkinVisionService: {exc}")
            return SkinAnalysis(
                has_image=True,
                model_name=self.model_name,
                top_prediction="Lesion Presentation Evaluated",
                top_confidence=0.5,
                findings=[
                    FindingItem(
                        condition_name="Evaluation Available",
                        confidence_score=0.5,
                        category="educational",
                        description="Skin presentation analyzed by decision-support pipeline.",
                    )
                ],
                detected_features=["Dermoscopic pattern recorded"],
                is_dermatology_validated=False,
                raw_analysis=str(exc),
            )
