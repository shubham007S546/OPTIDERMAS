"""Health check API endpoints."""

from fastapi import APIRouter
from app.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    """Returns backend operational status and service availability."""
    return {
        "ok": True,
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "vision_provider": settings.VISION_MODEL_PROVIDER,
        "groq_configured": bool(settings.GROQ_API_KEY),
        "elevenlabs_configured": bool(settings.ELEVEN_API_KEY),
    }
