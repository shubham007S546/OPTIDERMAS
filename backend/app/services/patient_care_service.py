"""OptiDerma Patient-Friendly Care & Empathy Synthesis Service.

Translates complex dermatological vision models, morphometrics, and clinical guidelines
into warm, compassionate, plain-language patient explanations, action plans, and doctor questions.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger("optiderma.patient_care")

# Human-friendly descriptions of the 7 HAM10000 skin conditions
PATIENT_FRIENDLY_CONDITIONS: Dict[str, Dict[str, Any]] = {
    "nv": {
        "plain_name": "Common Benign Mole (Melanocytic Nevus)",
        "one_liner": "A harmless, natural collection of pigment cells on your skin.",
        "is_cancer": False,
        "urgency": "Low Concern",
        "color": "green",
        "description": (
            "This spot looks like a standard common mole. Most adults have between 10 and 40 moles, "
            "and they are completely harmless natural variations in skin pigmentation. While this finding is "
            "reassuring, it is always healthy practice to keep an eye on your skin over time."
        ),
        "doctor_questions": [
            "Does this mole look healthy and typical for my skin type?",
            "How often should I have full-body skin checks given my personal mole count?",
            "Are there any specific spots on my body I should monitor more closely?",
        ],
        "home_care_dos": [
            "Take a clear photo every few months to see if it changes over time.",
            "Apply broad-spectrum sunscreen (SPF 30+) daily on exposed areas.",
            "Wear sun-protective clothing and hats during peak afternoon UV hours.",
        ],
        "home_care_donts": [
            "Do not scratch, pick, or attempt home removal techniques on any mole.",
            "Avoid indoor tanning beds, which dramatically increase skin damage.",
        ],
    },
    "bkl": {
        "plain_name": "Harmless Age Spot / Seborrheic Keratosis",
        "one_liner": "A common, harmless surface growth that occurs naturally as skin matures.",
        "is_cancer": False,
        "urgency": "Low Concern",
        "color": "green",
        "description": (
            "This spot matches a benign keratosis (often called a 'wisdom spot' or 'barnacle of life'). "
            "These spots frequently appear on chest, back, neck, or face as we age. They are entirely benign, "
            "meaning they do NOT turn into skin cancer and are strictly cosmetic."
        ),
        "doctor_questions": [
            "Can you confirm this is a benign keratosis during my regular checkup?",
            "If it catches on my clothing or gets irritated, what are the gentle removal options?",
            "How can I tell the difference between new age spots and spots that need checking?",
        ],
        "home_care_dos": [
            "Moisturize gently if the surface feels rough, dry, or waxy.",
            "Use daily sunscreen to prevent additional UV-related skin spots.",
        ],
        "home_care_donts": [
            "Do not try to scrape or peel it off yourself, which can cause infection or scarring.",
            "Do not apply aggressive acid treatments without a doctor's guidance.",
        ],
    },
    "df": {
        "plain_name": "Dermatofibroma (Harmless Skin Bump)",
        "one_liner": "A benign, firm little bump often caused by a minor bug bite or tiny scratch.",
        "is_cancer": False,
        "urgency": "Low Concern",
        "color": "green",
        "description": (
            "Dermatofibromas are completely harmless, firm spots that typically sit just under the surface of the skin, "
            "most commonly on the legs or arms. They often feel like a tiny pebble or lentil. They are non-cancerous and "
            "rarely need any treatment unless they bother you."
        ),
        "doctor_questions": [
            "Does this bump have the typical 'dimple sign' of a benign dermatofibroma?",
            "Is any treatment necessary, or is it completely fine to leave it alone?",
            "What signs should prompt me to come back for a re-check?",
        ],
        "home_care_dos": [
            "Take note of where it is and confirm it remains the same size.",
            "Leave it alone; no special creams or ointments are needed.",
        ],
        "home_care_donts": [
            "Do not squeeze or press aggressively on the bump.",
            "Do not shave aggressively directly over raised bumps.",
        ],
    },
    "vasc": {
        "plain_name": "Vascular Spot / Cherry Angioma",
        "one_liner": "A small, harmless cluster of tiny blood vessels close to the skin surface.",
        "is_cancer": False,
        "urgency": "Low Concern",
        "color": "green",
        "description": (
            "This spot appears to be a benign vascular mark, such as a cherry angioma. These bright red or purple spots "
            "are made of harmless little capillaries grouped together. They are very common, completely non-cancerous, "
            "and do not pose any threat to your health."
        ),
        "doctor_questions": [
            "Is this a classic cherry angioma or vascular malformation?",
            "If it occasionally bleeds when bumped, how can I easily manage it?",
            "If I prefer it removed for appearance, what is the simplest in-office option?",
        ],
        "home_care_dos": [
            "Keep the area clean and moisturized.",
            "If nicked while shaving, apply gentle pressure with a clean tissue for a few minutes.",
        ],
        "home_care_donts": [
            "Do not pick, scratch, or try to pop the spot, as it contains blood vessels.",
        ],
    },
    "akiec": {
        "plain_name": "Actinic Keratosis / Sun-Damaged Skin Patch",
        "one_liner": "A rough, scaly sun spot that should be reviewed and treated early by a doctor.",
        "is_cancer": False,
        "urgency": "Moderate Concern",
        "color": "amber",
        "description": (
            "This spot shows characteristics of an actinic keratosis—a precancerous surface patch caused by cumulative "
            "sun exposure over the years. The good news is that these are NOT invasive cancer today and are very easy "
            "for a dermatologist to treat in minutes using simple cold freezing (cryotherapy) or gentle prescription creams."
        ),
        "doctor_questions": [
            "Is this an actinic keratosis, and which treatment (cryotherapy vs cream) is best for me?",
            "Should we inspect other sun-exposed areas on my face, arms, and scalp?",
            "What sun protection regimen do you recommend to stop new ones from forming?",
        ],
        "home_care_dos": [
            "Schedule a routine visit with a dermatologist within the next few weeks.",
            "Wear a broad-spectrum mineral sunscreen (SPF 50+) and wide-brimmed hat outdoors.",
            "Keep the area moisturized to reduce flaking.",
        ],
        "home_care_donts": [
            "Do not pick at the rough scales or crusts.",
            "Do not stay outdoors in direct midday sun without protective shade.",
        ],
    },
    "bcc": {
        "plain_name": "Basal Cell Carcinoma (Highly Treatable Skin Spot)",
        "one_liner": "A common, slow-growing skin spot that is almost always cured when checked by a doctor.",
        "is_cancer": True,
        "urgency": "Attention Recommended",
        "color": "amber",
        "description": (
            "The visual features show patterns consistent with Basal Cell Carcinoma (BCC). While the word 'carcinoma' "
            "sounds frightening, please take reassurance: BCC is the most common form of skin spot, grows extremely "
            "slowly over months or years, and almost never spreads to other parts of the body. When evaluated and treated "
            "by a dermatologist, cure rates exceed 95% to 99%."
        ),
        "doctor_questions": [
            "What type of biopsy or optical dermoscopy check do you recommend today?",
            "What are the best gentle removal options (shave, minor excision, or Mohs surgery)?",
            "What will the healing and cosmetic outcome look like after treatment?",
        ],
        "home_care_dos": [
            "Schedule an appointment with a dermatologist or skin specialist within 1 to 2 weeks.",
            "Protect the spot from sun exposure while waiting for your appointment.",
            "Keep a simple bandage over it if it gets caught on clothing.",
        ],
        "home_care_donts": [
            "Do not worry or panic—this type of spot is very slow-moving and highly treatable.",
            "Do not apply harsh home remedies, bleach, or unverified creams.",
        ],
    },
    "mel": {
        "plain_name": "Atypical Lesion / Needs Prompt Dermatologist Check",
        "one_liner": "Features show irregularity that warrants an in-person examination and biopsy.",
        "is_cancer": True,
        "urgency": "Prompt Attention Recommended",
        "color": "red",
        "description": (
            "The AI detected features (such as uneven color, asymmetrical shape, or darker pigmentation) that require "
            "professional evaluation. It is very important to understand: an AI photo scan is NOT a diagnosis. Many spots "
            "that look atypical turn out to be completely benign dysplastic moles once a doctor examines them with a "
            "dermatoscope. However, because early checks are the safest course of action, you should schedule a visit "
            "with a dermatologist promptly."
        ),
        "doctor_questions": [
            "Can we perform a dermoscopic evaluation and an in-office biopsy of this spot?",
            "How soon will the pathology results be ready, and what are the next steps?",
            "Can we do a complete skin check of my entire body during this visit?",
        ],
        "home_care_dos": [
            "Schedule an appointment with a board-certified dermatologist within 7 to 10 days.",
            "Write down when you first noticed this spot and if it has grown, changed color, or bled.",
            "Take a clear photo with a coin or ruler next to it for your doctor to see.",
        ],
        "home_care_donts": [
            "Do not delay scheduling your appointment.",
            "Do not scratch, irritate, or try any home remedies on this spot.",
        ],
    },
}


class PatientCareSummary(BaseModel):
    headline: str
    condition_plain_name: str
    concern_level: str
    concern_color: str
    simple_explanation: str
    what_ai_noticed: Dict[str, str] = Field(default_factory=dict)
    action_plan: List[str] = Field(default_factory=list)
    doctor_questions: List[str] = Field(default_factory=list)
    home_care_dos: List[str] = Field(default_factory=list)
    home_care_donts: List[str] = Field(default_factory=list)
    is_emergency: bool = False


def _get_groq_client_safe():
    current_key = getattr(settings, "GROQ_API_KEY", None) or os.getenv("GROQ_API_KEY")
    if not current_key:
        return None
    try:
        from groq import Groq
        return Groq(api_key=current_key, timeout=7.0)
    except Exception as exc:
        logger.warning(f"Groq init error in patient care: {exc}")
        return None


def generate_patient_care_summary(
    analysis_record: Dict[str, Any],
    user_query: Optional[str] = None,
) -> Dict[str, Any]:
    """Generates a warm, empathetic, plain-language patient care summary.
    Uses Groq LLM (qwen/qwen3.8-27b) when available, with rich condition-specific synthesis fallback.
    """
    top3 = analysis_record.get("top3", [])
    top_code = top3[0][0] if top3 else "nv"
    top_prob = float(top3[0][1]) if top3 else 0.5
    top_pct = f"{top_prob * 100:.1f}%"

    info = PATIENT_FRIENDLY_CONDITIONS.get(top_code, PATIENT_FRIENDLY_CONDITIONS["nv"])
    metrics = analysis_record.get("metrics", {})
    asym = float(metrics.get("asymmetry_index", 0.0))
    compact = float(metrics.get("compactness", 1.0))
    area_mm2 = float(metrics.get("area_mm2", 0.0))
    hair_diag = analysis_record.get("hair_removal", {})
    strands = hair_diag.get("detected_strands", 0)

    # Human-friendly translations of measurements
    if asym < 0.25:
        symmetry_text = "Even & Balanced (both halves match well)"
    elif asym < 0.50:
        symmetry_text = "Mildly Uneven (slight difference between sides)"
    else:
        symmetry_text = "Asymmetrical (one side looks notably different from the other)"

    if compact > 0.85:
        border_text = "Smooth & Regular (well-defined clean edges)"
    elif compact > 0.60:
        border_text = "Gentle Contour (mostly regular perimeter)"
    else:
        border_text = "Irregular / Notched (edges show slight unevenness)"

    if top_code in {"mel", "bcc"}:
        color_text = "Varied Pigment (multiple tones or dark highlights detected)"
    elif top_code == "vasc":
        color_text = "Reddish / Pink Vascular Tone (characteristic of blood vessels)"
    elif top_code == "akiec":
        color_text = "Pink / Tan with Scaly Surface Texture"
    else:
        color_text = "Uniform & Consistent (single even pigment tone)"

    if area_mm2 > 0.1:
        size_text = f"~{area_mm2:.1f} mm² area (roughly {min(area_mm2 * 0.4, 9.0):.1f} mm across, comparable to a pencil eraser)"
    else:
        size_text = "Small, discrete skin lesion"

    what_noticed = {
        "symmetry": symmetry_text,
        "border": border_text,
        "color": color_text,
        "size": size_text,
    }

    # Action plan steps
    if info["urgency"] == "Low Concern":
        headline = f"Good News: Visual pattern matches a {info['plain_name']}"
        action_plan = [
            "Keep an eye on this spot as part of your regular skin awareness.",
            "Take a well-lit photo every 3 months so you can easily compare over time.",
            "Mention it at your next routine physical or dermatologist visit for peace of mind.",
        ]
    elif info["urgency"] == "Moderate Concern":
        headline = f"Doctor Check Recommended: Features suggest an {info['plain_name']}"
        action_plan = [
            "Schedule an appointment with a dermatologist within the next 2 to 3 weeks.",
            "Do not worry—this is a very common, highly treatable skin condition.",
            "Protect the area with sunscreen (SPF 30+) daily until your visit.",
        ]
    else:
        headline = f"Prompt Review Advised: Please have a dermatologist inspect this spot"
        action_plan = [
            "Contact a dermatology clinic to schedule an in-person evaluation within 7 to 10 days.",
            "Bring this summary packet and any past photos of the spot to your visit.",
            "Remember: an AI photo review is not a biopsy; many suspicious-looking spots turn out benign.",
        ]

    # Attempt dynamic Groq GenAI generation for an ultra-tailored, empathetic summary
    client = _get_groq_client_safe()
    dynamic_explanation = None

    if client:
        try:
            prompt = (
                f"You are OptiDerma's warm, compassionate Patient Care Advocate AI. "
                f"A patient uploaded a photo of their skin spot. The computer vision analysis matched: {info['plain_name']} "
                f"({top_pct} confidence score), risk level: {info['urgency']}. "
                f"Key visual signs: Shape={symmetry_text}, Border={border_text}, Color={color_text}, Size={size_text}. "
                f"Cleaned hair strands: {strands}. "
                f"Write a 2-paragraph patient-friendly explanation in warm, comforting, plain English. "
                f"Rules:\n"
                f"1. Explain what this spot is in simple everyday language (like talking to a friend).\n"
                f"2. Emphasize that AI is a helper, not a biopsy, so there is no reason to panic.\n"
                f"3. Give clear, calm reassurance while responsibly advising when to see a doctor.\n"
                f"4. Do NOT use intimidating Latin medical jargon without immediately translating it."
            )
            model_candidate = getattr(settings, "GROQ_MODEL", "qwen/qwen3.8-27b") or "qwen/qwen3.8-27b"
            resp = client.chat.completions.create(
                model=model_candidate,
                messages=[
                    {"role": "system", "content": "You are an empathetic, reassuring, plain-language patient health advisor."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=400,
            )
            raw = resp.choices[0].message.content or ""
            if raw.strip():
                dynamic_explanation = raw.strip()
        except Exception as exc:
            logger.info(f"Groq patient care generation bypassed: {exc}")

    final_explanation = dynamic_explanation or info["description"]

    return {
        "headline": headline,
        "condition_plain_name": info["plain_name"],
        "concern_level": info["urgency"],
        "concern_color": info["color"],
        "simple_explanation": final_explanation,
        "what_ai_noticed": what_noticed,
        "action_plan": action_plan,
        "doctor_questions": info["doctor_questions"],
        "home_care_dos": info["home_care_dos"],
        "home_care_donts": info["home_care_donts"],
        "is_emergency": False,
    }
