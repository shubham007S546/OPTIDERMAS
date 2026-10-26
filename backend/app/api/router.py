"""Main API Router aggregating module sub-routers."""

from fastapi import APIRouter
from app.api.health import router as health_router
from app.api.analyze import router as analyze_router
from app.api.voice import router as voice_router
from app.api.rag import router as rag_router
from app.api.agent import router as agent_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router)
api_router.include_router(analyze_router)
api_router.include_router(voice_router)
api_router.include_router(rag_router)
api_router.include_router(agent_router)

