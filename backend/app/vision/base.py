"""Abstract base interface for skin vision model services."""

from abc import ABC, abstractmethod
from typing import Optional
from app.schemas.dermatology import SkinAnalysis


class BaseSkinVisionService(ABC):
    """Abstract class defining the contract for skin image analysis engines."""

    @abstractmethod
    def analyze_skin_image(
        self, image_bytes: bytes, query: Optional[str] = None
    ) -> SkinAnalysis:
        """Analyze raw image bytes and return a structured SkinAnalysis object."""
        pass
