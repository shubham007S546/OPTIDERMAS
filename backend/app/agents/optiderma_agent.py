"""Central OptiDerma Agent Orchestrator combining Vision, RAG, Safety, and Medical Reasoning."""

import base64
from typing import Optional
from app.rag.dermatology_rag import DermatologyRAGService
from app.safety.safety_checker import SafetyChecker
from app.schemas.dermatology import (
    AgentRequest,
    AgentResponse,
    MedicalAssessment,
    SkinAnalysis,
    UserSymptoms,
)
from app.utils.logger import logger
from app.vision.base import BaseSkinVisionService
from app.vision.groq_vision import GroqSkinVisionService


class OptiDermaAgent:
    """Central agent orchestrator for dermatology educational decision support."""

    def __init__(
        self,
        vision_service: Optional[BaseSkinVisionService] = None,
        rag_service: Optional[DermatologyRAGService] = None,
        safety_checker: Optional[SafetyChecker] = None,
    ):
        from app.config import settings
        if vision_service:
            self.vision_service = vision_service
        elif settings.GROQ_API_KEY and settings.VISION_MODEL_PROVIDER == "groq":
            self.vision_service = GroqSkinVisionService()
        else:
            from app.vision.efficientnet_vision import EfficientNetSkinVisionService
            self.vision_service = EfficientNetSkinVisionService()
        self.rag_service = rag_service or DermatologyRAGService()
        self.safety_checker = safety_checker or SafetyChecker()

    def process(self, request: AgentRequest) -> AgentResponse:
        logger.info(f"OptiDermaAgent processing query: '{request.query[:50]}...'")

        # 1. Safety Check (Emergency Triage)
        safety_eval = self.safety_checker.evaluate(request.query, request.symptoms)

        if safety_eval.is_emergency and safety_eval.override_guidance:
            logger.warning("Emergency override triggered by safety checker.")
            return AgentResponse(
                user_query=request.query,
                safety=safety_eval,
                skin_analysis=None,
                retrieved_evidence=[],
                assessment=MedicalAssessment(
                    differential_possibilities=["Medical Emergency / Red Flag Indicator"],
                    summary_explanation=safety_eval.override_guidance,
                    supporting_symptoms=safety_eval.red_flags_detected,
                    clarifying_questions=[],
                    general_guidance="Seek immediate emergency medical evaluation.",
                    red_flags=safety_eval.red_flags_detected,
                    consultation_recommended=True,
                ),
            )

        # 2. Vision Analysis (if image provided)
        skin_analysis: Optional[SkinAnalysis] = None
        if request.image_base64:
            try:
                img_bytes = base64.b64decode(request.image_base64)
                skin_analysis = self.vision_service.analyze_skin_image(
                    img_bytes, query=request.query
                )
            except Exception as exc:
                logger.error(f"Failed to decode or analyze image: {exc}")

        # 3. Dermatology RAG Evidence Retrieval
        retrieved_passages = self.rag_service.retrieve_evidence(request.query, top_k=2)

        # 4. Comprehensive Medical Reasoning & Clinical Assessment Generation
        differentials = []
        if skin_analysis and skin_analysis.findings:
            differentials.extend([f.condition_name for f in skin_analysis.findings])
        else:
            differentials.extend([
                "Melanocytic Nevus (Benign Common Mole)",
                "Seborrheic Keratosis / Benign Keratosis",
                "Basal Cell Carcinoma / Intraepithelial Pre-cancer",
            ])

        top_pred_title = skin_analysis.top_prediction if skin_analysis else "Dermoscopic Lesion Presentation"

        summary = (
            f"OptiDerma Decision-Support Report: Synthesized evaluation for request '{request.query}'. "
            f"Primary visual finding indicates {top_pred_title} with a differential confidence profile. "
        )
        if skin_analysis and skin_analysis.raw_analysis:
            summary += f"Vision reasoning details: {skin_analysis.raw_analysis} "

        if retrieved_passages:
            summary += f"\n\nClinical Evidence Reference ({retrieved_passages[0].title} - {retrieved_passages[0].source}): "
            summary += f"{retrieved_passages[0].content[:240]}..."

        questions = [
            "Have you noticed any recent change in size, shape, color, or elevation (ABCDE criteria)?",
            "Does the lesion exhibit bleeding, oozing, itching, crusting, or persistent pain?",
            "Do you have a personal or family history of melanoma or atypical mole syndrome?",
            "Has the lesion been exposed to intense solar radiation or tanning equipment?",
        ]

        guidance = (
            "1. Monitor closely for ABCDE changes (Asymmetry, Border irregularity, Color variation, Diameter > 6mm, Evolution).\n"
            "2. Avoid trauma, scratching, or self-treatment with over-the-counter remedies.\n"
            "3. Schedule a formal epiluminescence microscopy or dermoscopy check with a board-certified dermatologist."
        )

        assessment = MedicalAssessment(
            differential_possibilities=differentials,
            summary_explanation=summary,
            supporting_symptoms=request.symptoms.associated_symptoms if request.symptoms else ["Dermoscopic visual pattern"],
            clarifying_questions=questions,
            general_guidance=guidance,
            red_flags=safety_eval.red_flags_detected,
            consultation_recommended=True,
        )

        return AgentResponse(
            user_query=request.query,
            safety=safety_eval,
            skin_analysis=skin_analysis,
            retrieved_evidence=retrieved_passages,
            assessment=assessment,
        )
