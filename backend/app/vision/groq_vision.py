"""Groq Llama Vision implementation of the skin vision interface."""

import base64
from typing import Optional
from app.config import settings
from app.schemas.dermatology import FindingItem, SkinAnalysis
from app.utils.logger import logger
from app.vision.base import BaseSkinVisionService


class GroqSkinVisionService(BaseSkinVisionService):
    """Vision engine wrapper leveraging Groq Llama-4/3.2 Multimodal Vision models."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.model_name = "llama-3.2-11b-vision-preview"

    def analyze_skin_image(
        self, image_bytes: bytes, query: Optional[str] = None
    ) -> SkinAnalysis:
        if not self.api_key:
            logger.warning("GROQ_API_KEY not configured. Returning fallback vision response.")
            return SkinAnalysis(
                has_image=True,
                model_name=self.model_name,
                top_prediction="Image received (Groq API Key unconfigured)",
                top_confidence=0.5,
                findings=[
                    FindingItem(
                        condition_name="Visual Presentation Observed",
                        confidence_score=0.5,
                        category="educational",
                        description="Image was provided. Configure GROQ_API_KEY to activate full multimodal reasoning.",
                    )
                ],
                detected_features=["User Uploaded Image"],
                is_dermatology_validated=False,
                raw_analysis="Image uploaded successfully. API key required for full LLM analysis.",
            )

        try:
            from groq import Groq

            encoded_image = base64.b64encode(image_bytes).decode("utf-8")
            client = Groq(api_key=self.api_key)

            user_prompt = (
                query
                or "Examine this skin image for educational decision support. Identify notable skin presentation features, potential differential conditions, and general advice."
            )

            system_instruction = (
                "You are an AI dermatology decision-support assistant. "
                "Describe the visual features of the skin presentation in the image, "
                "list possible educational differential considerations, and highlight red flags. "
                "Do NOT claim to make a definitive diagnosis."
            )

            messages = [
                {"role": "system", "content": system_instruction},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{encoded_image}"
                            },
                        },
                    ],
                },
            ]

            response = client.chat.completions.create(
                messages=messages, model=self.model_name
            )

            raw_text = response.choices[0].message.content or ""

            return SkinAnalysis(
                has_image=True,
                model_name=self.model_name,
                top_prediction="Multimodal Visual Findings",
                top_confidence=0.75,
                findings=[
                    FindingItem(
                        condition_name="Visual Feature Observation",
                        confidence_score=0.75,
                        category="educational",
                        description=raw_text[:300] + "..." if len(raw_text) > 300 else raw_text,
                    )
                ],
                detected_features=["Dermoscopic / Clinical Surface Pattern"],
                is_dermatology_validated=False,
                raw_analysis=raw_text,
            )
        except Exception as exc:
            logger.error(f"Error executing Groq vision model analysis: {exc}")
            return SkinAnalysis(
                has_image=True,
                model_name=self.model_name,
                top_prediction="Analysis Exception",
                top_confidence=0.0,
                findings=[],
                is_dermatology_validated=False,
                raw_analysis=f"Vision model error: {exc}",
            )
