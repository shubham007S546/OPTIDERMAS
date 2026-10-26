"""Dermatology-specific Knowledge RAG service module."""

from typing import List, Optional
from app.schemas.dermatology import RAGPassage
from app.utils.logger import logger

# Initial knowledge base index for dermatology clinical guidance and patient education
DERMATOLOGY_KNOWLEDGE_BASE = [
    {
        "title": "Contact Dermatitis Clinical Guidance",
        "source": "Dermatology Educational Reference Manual, 2025 Edition",
        "content": (
            "Contact dermatitis is an inflammatory skin reaction resulting from exposure to allergens "
            "or irritants (e.g., cosmetic fragrances, topical creams, soaps, or plants). "
            "Characteristics include localized erythema, pruritus, and occasional vesiculation. "
            "First-line self-care involves identifying and withdrawing the suspected offending agent, "
            "cool compresses, and gentle non-soap cleansers."
        ),
        "keywords": ["contact dermatitis", "rash", "itch", "soap", "cream", "cosmetics", "allergic"],
    },
    {
        "title": "Actinic Keratosis and Sun-Exposed Lesions",
        "source": "Clinical Dermatology Decision Support Protocols",
        "content": (
            "Actinic keratosis (AK) manifests as rough, scaly, erythematous patches on sun-exposed "
            "areas (face, ears, scalp, forearms). Considered a pre-cancerous intraepithelial lesion, "
            "AK requires dermatological evaluation to differentiate from basal cell or squamous cell carcinoma."
        ),
        "keywords": ["actinic keratosis", "scaly", "rough", "sun", "solar", "face", "forearm"],
    },
    {
        "title": "Melanocytic Nevi vs. Melanoma Screening (ABCDE Criteria)",
        "source": "Skin Cancer Prevention & Triage Framework",
        "content": (
            "The ABCDE criteria guide visual inspection of pigmented skin lesions: "
            "Asymmetry (half does not match the other), Border irregularity (notched or blurred), "
            "Color variation (multiple shades of brown, black, or red), Diameter (>6mm), and "
            "Evolving (changing in size, shape, color, or symptoms such as bleeding or itching)."
        ),
        "keywords": ["mole", "nevus", "melanoma", "abcde", "pigmented", "dark spot", "changing"],
    },
    {
        "title": "Atopic Dermatitis & Eczema Management",
        "source": "Pediatric & Adult Dermatology Care Guidelines",
        "content": (
            "Atopic dermatitis is a chronic, relapsing inflammatory skin condition characterized by "
            "intense pruritus, xerosis, and erythematous plaques. Management focuses on skin barrier "
            "repair using frequent emollient application and avoidance of harsh surfactants."
        ),
        "keywords": ["eczema", "atopic", "dry skin", "pruritus", "itchy rash", "emollient"],
    },
]


class DermatologyRAGService:
    """Retrieves grounded dermatology reference passages matching clinical queries."""

    def __init__(self):
        self.kb = DERMATOLOGY_KNOWLEDGE_BASE

    def retrieve_evidence(self, query: str, top_k: int = 2) -> List[RAGPassage]:
        logger.info(f"Retrieving dermatology RAG evidence for query: '{query}'")
        query_terms = set(query.lower().split())
        scored_results = []

        for item in self.kb:
            score = 0.0
            for kw in item["keywords"]:
                if kw in query.lower():
                    score += 1.5
            for term in query_terms:
                if term in item["content"].lower():
                    score += 0.5

            if score > 0:
                scored_results.append((score, item))

        scored_results.sort(key=lambda x: x[0], reverse=True)
        results: List[RAGPassage] = []

        for score, item in scored_results[:top_k]:
            results.append(
                RAGPassage(
                    title=item["title"],
                    source=item["source"],
                    content=item["content"],
                    relevance_score=round(score, 2),
                    metadata={"keywords": item["keywords"]},
                )
            )

        return results
