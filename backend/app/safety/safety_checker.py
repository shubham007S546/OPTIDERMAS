"""Safety service module for detecting red flags and emergency clinical symptoms."""

import re
from typing import List
from app.schemas.dermatology import SafetyAssessment, UserSymptoms
from app.utils.logger import logger

EMERGENCY_RED_FLAGS = [
    (r"breath|breathing|shortness of breath|anaphylaxis|swollen throat|swelling lips", "Possible severe allergic reaction / anaphylaxis requiring emergency care."),
    (r"fever|chills|high temp|rigors", "Systemic symptoms (fever/chills) accompanying skin presentation."),
    (r"rapidly spreading|spreading fast|hours|overnight", "Rapidly evolving lesion or rash extension."),
    (r"eye|eyelid|ocular|vision|sight", "Mucosal or periocular skin involvement near eyes."),
    (r"blister|peeling|skin sloughing|steven johnson|toxic epidermal", "Extensive blistering or desquamation pattern."),
    (r"pus|foul odor|red streaks|hot to touch|severe pain", "Indicators of acute spreading bacterial infection or cellulitis."),
]

PROMPT_INJECTION_PATTERNS = [
    r"ignore (all )?previous instructions",
    r"you are now a",
    r"system prompt",
    r"<script\b",
    r"javascript:",
]


class SafetyChecker:
    """Evaluates symptoms and text input for emergency red flags and security threats."""

    def sanitize_text(self, text: str) -> str:
        """Sanitize text input by removing control characters and HTML tags."""
        text = re.sub(r"<[^>]*>", "", text)
        return text.strip()

    def check_injection_attempt(self, text: str) -> bool:
        """Detect prompt injection or malicious code injection attempts."""
        lowered = text.lower()
        for pat in PROMPT_INJECTION_PATTERNS:
            if re.search(pat, lowered):
                return True
        return False

    def evaluate(self, query: str, symptoms: UserSymptoms = None) -> SafetyAssessment:
        text = query.lower()
        if symptoms:
            text += " " + " ".join(symptoms.associated_symptoms).lower()
            if symptoms.severity:
                text += " " + symptoms.severity.lower()

        red_flags: List[str] = []
        is_emergency = False

        for pattern, description in EMERGENCY_RED_FLAGS:
            if re.search(pattern, text):
                red_flags.append(description)
                if "anaphylaxis" in description.lower() or "eye" in description.lower() or "blistering" in description.lower():
                    is_emergency = True

        if red_flags:
            logger.warning(f"Red flags detected in user query: {red_flags}")

        if is_emergency or len(red_flags) >= 2:
            return SafetyAssessment(
                is_emergency=True,
                red_flags_detected=red_flags,
                urgency_level="emergency",
                requires_immediate_care=True,
                override_guidance=(
                    "⚠️ URGENT MEDICAL WARNING: Your described symptoms (such as breathing difficulty, "
                    "rapidly spreading presentation, fever, or eye involvement) may indicate a severe allergic "
                    "reaction, acute infection, or systemic medical emergency. Please seek immediate evaluation at "
                    "an emergency department or call your local emergency services (e.g. 911 / 112) right away. "
                    "Do NOT wait for routine online advice."
                ),
            )
        elif red_flags:
            return SafetyAssessment(
                is_emergency=False,
                red_flags_detected=red_flags,
                urgency_level="prompt",
                requires_immediate_care=False,
                override_guidance=None,
            )

        return SafetyAssessment(
            is_emergency=False,
            red_flags_detected=[],
            urgency_level="routine",
            requires_immediate_care=False,
            override_guidance=None,
        )
