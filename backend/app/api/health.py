"""Health check API endpoints."""

from fastapi import APIRouter
from app.config import settings

router = APIRouter(tags=["Health"])


@router.api_route("/health", methods=["GET", "HEAD"])
def health_check():
    """Returns backend operational status and service availability."""
    from app.services.persistence_service import check_supabase_health, get_persistence_mode
    pers_health = check_supabase_health()
    return {
        "ok": True,
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "vision_provider": settings.VISION_MODEL_PROVIDER,
        "groq_configured": bool(settings.GROQ_API_KEY),
        "elevenlabs_configured": bool(settings.ELEVEN_API_KEY),
        "persistence": {
            "mode": get_persistence_mode(),
            "supabase": pers_health,
            "sqlite_wal": "active",
        },
    }


@router.api_route("/health/persistence", methods=["GET", "HEAD"])
def persistence_health_check():
    """Returns detailed persistence operational status and database readiness."""
    from app.services.persistence_service import PersistenceService
    return PersistenceService.get_detailed_health()

