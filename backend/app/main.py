"""OptiDerma Unified Multimodal AI Decision Support Backend.

Single coherent API architecture implementing:
- GET  /health                       -> Basic operational heartbeat
- GET  /ready                        -> Deterministic model weight & service readiness check
- POST /predict                      -> Standard dermoscopic image inference (backward-compatible)
- POST /analyze                      -> Comprehensive multimodal analysis with RAG & safety triage
- GET  /analysis/{analysis_id}       -> Retrieve canonical analysis record
- POST /analysis/{analysis_id}/verify-> Independent deterministic verification audit
- GET  /analysis/{analysis_id}/report-> Patient-friendly or technical research JSON report
- GET  /analysis/{analysis_id}/report/pdf -> Downloadable publication-grade PDF report
"""

import os
import sys
import time
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Restrict threading pools to 1 thread to keep memory usage under 200MB on free-tier containers
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

_APP_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _APP_DIR.parent
_ROOT_DIR = _BACKEND_DIR.parent
_MODEL_DIR = _ROOT_DIR / "model"

for _p in (str(_BACKEND_DIR), str(_MODEL_DIR), str(_ROOT_DIR)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware

from pydantic import BaseModel, Field

from app.api.router import api_router
from app.agents.optiderma_agent import optiderma_workflow
from app.config import settings
from app.services.care_service import generate_consultation_summary, search_dermatologists
from app.services.inference_service import (
    ANALYSIS_STORE,
    is_model_ready,
    recompute_xai_for_class,
    run_prediction,
)
from app.services.persistence_service import PersistenceService
from app.services.report_service import (
    build_pdf_report,
    generate_patient_report,
    generate_technical_report,
)
from app.services.verification_service import verification_service
from app.utils.logger import logger

MAX_PAYLOAD_BYTES = 20 * 1024 * 1024  # 20 MB Limit
RATE_LIMIT_WINDOW = 60.0

_ip_request_timestamps = defaultdict(list)


class ConversationRequest(BaseModel):
    query: Optional[str] = None
    message: Optional[str] = None
    user_id: Optional[str] = "patient_user"
    conversation_id: Optional[str] = None
    analysis_id: Optional[str] = None
    mode: Optional[str] = "patient"


class CreateConversationSchema(BaseModel):
    title: Optional[str] = None
    user_id: Optional[str] = "patient_user"
    analysis_id: Optional[str] = None
    mode: Optional[str] = "general"


class UpdateConversationSchema(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)


class AppointmentRequestSchema(BaseModel):
    analysis_id: Optional[str] = None
    patient_name: str
    contact_email: str
    contact_phone: Optional[str] = ""
    city: Optional[str] = ""
    district: Optional[str] = ""
    pin_code: Optional[str] = ""
    clinic_id: Optional[str] = ""
    clinic_name: Optional[str] = ""
    preferred_date: str
    consultation_type: str = "in-person"
    reason: Optional[str] = ""
    consultation_summary: Optional[str] = ""
    user_consent: bool = True


class ConsultationSummaryRequest(BaseModel):
    questions: Optional[List[str]] = None
    user_notes: Optional[str] = ""


class SecurityAndRateLimitMiddleware(BaseHTTPMiddleware):
    """Enforces Security Headers, Request Tracing, Payload Limits, and IP Rate Limiting."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

        content_length = request.headers.get("Content-Length")
        if content_length and int(content_length) > MAX_PAYLOAD_BYTES:
            return JSONResponse(
                status_code=413,
                content={"error": "Payload Too Large", "message": "Request payload exceeds 20 MB limit."},
            )

        # Skip rate limit on health / readiness checks
        if request.url.path in ("/health", "/ready", "/api/v1/health", "/"):
            response: Response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
            return response

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        timestamps = _ip_request_timestamps[client_ip]
        _ip_request_timestamps[client_ip] = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]

        max_limit = getattr(settings, "RATE_LIMIT_PER_MINUTE", 300)
        if len(_ip_request_timestamps[client_ip]) >= max_limit:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return JSONResponse(
                status_code=429,
                content={"error": "Too Many Requests", "message": "Rate limit exceeded. Please wait a minute."},
            )

        _ip_request_timestamps[client_ip].append(now)

        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.PROJECT_NAME} (v{settings.VERSION}) in {settings.ENVIRONMENT} mode.")
    # Pre-warming skipped on startup to preserve free-tier memory limit (< 512MB)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "OptiDerma Clinical Dermatology AI Decision Support System. "
        "Provides 7-class differential prediction, real U-Net segmentation, Grad-CAM explainability, "
        "independent verification audits, grounded RAG evidence, and emergency safety triage."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(SecurityAndRateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.onrender\.com|http://localhost:\d+|http://127\.0\.0\.1:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Pass through HTTP exceptions with structured response."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Catch unexpected unhandled internal exceptions."""
    logger.error(f"Unhandled server exception on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred while processing your request.",
        },
    )


# Attach API v1 Router
app.include_router(api_router)


# --------------------------------------------------------------------------- #
# Core Unified Endpoints
# --------------------------------------------------------------------------- #

@app.get("/health", tags=["System"])
def health_check():
    """Liveness check for container orchestration and uptime monitors."""
    return {"ok": True, "service": settings.PROJECT_NAME, "version": settings.VERSION}


@app.get("/ready", tags=["System"])
def readiness_check():
    """Readiness check: fails (HTTP 503) if model weights or essential pipeline components cannot load."""
    if not is_model_ready():
        raise HTTPException(
            status_code=503,
            detail="Model weights or inference pipeline unavailable. Service is not ready for requests.",
        )
    return {"ready": True, "model": "EfficientNet-B4 (7-class + U-Net)", "weights": "optiderma_best_model.pth"}


@app.post("/predict", tags=["Inference"])
async def predict_endpoint(
    file: UploadFile = File(..., description="Dermoscopy image file (JPEG/PNG/WEBP)"),
    force: bool = Query(False, description="Skip image-quality audit and force inference"),
    fov_mm: float = Query(15.0, description="Dermoscope field-of-view diameter in mm"),
    target_class: Optional[str] = Query(None, description="Optional class code for Grad-CAM targeting (e.g. bcc, mel)"),
):
    """Primary inference route compatible with Next.js frontend client."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No image file provided in 'file' field")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    return run_prediction(
        image_bytes=raw,
        force=force,
        fov_mm=fov_mm,
        target_class=target_class,
    )


@app.post("/analyze", tags=["Inference"])
async def analyze_endpoint(
    file: UploadFile = File(..., description="Dermoscopy image file"),
    query: Optional[str] = Query(None, description="Patient symptoms or clinical query"),
    force: bool = Query(False, description="Force inference past quality warnings"),
    fov_mm: float = Query(15.0, description="Dermoscope field of view in mm"),
    target_class: Optional[str] = Query(None, description="Target class code for Grad-CAM"),
):
    """Multimodal analysis endpoint combining raw image, symptoms, RAG evidence, and safety triage."""
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    return run_prediction(
        image_bytes=raw,
        force=force,
        fov_mm=fov_mm,
        target_class=target_class,
        user_query=query,
    )


@app.get("/analyses", tags=["Analysis"])
def list_analyses_endpoint(limit: int = Query(20, ge=1, le=100)):
    """Retrieve recent persisted analyses for history and dashboard."""
    return {"analyses": PersistenceService.list_analyses(limit=limit)}


@app.get("/analysis/{analysis_id}", tags=["Analysis"])
def get_analysis_by_id(analysis_id: str):
    """Retrieve canonical analysis record by unique analysis UUID from persistent store."""
    record = PersistenceService.get_analysis(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Analysis ID '{analysis_id}' not found.")
    return record


@app.get("/analysis/{analysis_id}/xai", tags=["Explainability"])
def get_analysis_xai_endpoint(
    analysis_id: str,
    target_class: str = Query("top1", description="Target class code (e.g. 'mel', 'bcc') or 'compare' for multi-class comparison"),
):
    """Retrieve or dynamically recompute class-specific Grad-CAM attributions and spatial energy diagnostics."""
    return recompute_xai_for_class(analysis_id, target_class)


@app.post("/analysis/{analysis_id}/verify", tags=["Verification"])
def verify_analysis_endpoint(analysis_id: str):
    """Run independent deterministic verification audit on a stored analysis record."""
    record = PersistenceService.get_analysis(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Analysis ID '{analysis_id}' not found.")

    verif = verification_service.verify_analysis(
        analysis_data=record,
        quality_data=record.get("quality"),
    )
    verif_dict = verif.to_dict()
    record["verification"] = verif_dict
    PersistenceService.update_verification(analysis_id, verif_dict)
    return verif_dict


@app.get("/analysis/{analysis_id}/council", tags=["Agent Council"])
def get_analysis_council_endpoint(analysis_id: str):
    """Retrieve or dynamically execute the Multi-Agent Clinical Council deliberation for a case."""
    record = PersistenceService.get_analysis(analysis_id)
    if record is None:
        if analysis_id.startswith("mock-") or "sample" in analysis_id:
            from app.agents.council import clinical_council
            mock_record = {
                "analysis_id": analysis_id,
                "top3": [["akiec", 0.996], ["bcc", 0.003], ["bkl", 0.0005]],
                "malignant_prob": 0.999,
                "risk": {
                    "level": "Moderate",
                    "recommendation": "Dermatological evaluation advised (scheduled within 3–6 weeks) with close self-monitoring.",
                },
                "metrics": {
                    "area_px": 9158,
                    "perimeter_px": 442.09,
                    "area_mm2": 24.8,
                    "perimeter_mm": 19.4,
                    "asymmetry_index": 0.38,
                    "compactness": 1.21,
                    "coverage_pct": 14.6,
                },
                "hair_removal": {"hair_detected": False},
                "verification": {"passed": True, "requires_review": False, "warnings": []},
                "quality": {"is_out_of_distribution": False, "passed": True},
            }
            consensus = clinical_council.deliberate(
                analysis_record=mock_record,
                query="Clinical review for offline sample case",
            )
            return consensus.model_dump()
        raise HTTPException(status_code=404, detail=f"Analysis ID '{analysis_id}' not found.")

    council = record.get("council")
    if not council:
        from app.agents.council import clinical_council
        council_consensus = clinical_council.deliberate(
            analysis_record=record,
            query=record.get("user_query"),
        )
        council = council_consensus.model_dump()
        record["council"] = council
        try:
            PersistenceService.save_analysis(record)
        except Exception:
            pass
    return council


@app.get("/analysis/{analysis_id}/report", tags=["Reporting"])
def get_analysis_report(
    analysis_id: str,
    report_type: str = Query("technical", description="'patient' or 'technical'"),
    diff_threshold: float = Query(0.20, ge=0.01, le=0.90, description="Confidence separation threshold between top 2 classes"),
):
    """Generate structured Patient-Friendly or Technical Research JSON report from canonical analysis record."""
    record = PersistenceService.get_analysis(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Analysis ID '{analysis_id}' not found.")

    if report_type.lower() == "patient":
        return generate_patient_report(record, diff_threshold=diff_threshold)
    return generate_technical_report(record, diff_threshold=diff_threshold)


@app.get("/analysis/{analysis_id}/report/pdf", tags=["Reporting"])
def get_analysis_pdf_report(
    analysis_id: str,
    diff_threshold: float = Query(0.20, ge=0.01, le=0.90, description="Confidence separation threshold between top 2 classes"),
):
    """Compile and download publication-quality PDF report from canonical analysis record."""
    record = PersistenceService.get_analysis(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Analysis ID '{analysis_id}' not found.")

    pdf_bytes = build_pdf_report(record, diff_threshold=diff_threshold)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="optiderma_report_{analysis_id[:8]}.pdf"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


@app.get("/conversations", tags=["Conversation & RAG"])
def list_conversations_endpoint(
    user_id: Optional[str] = Query(None, description="Optional user ID filter"),
    analysis_id: Optional[str] = Query(None, description="Optional analysis ID filter"),
    limit: int = Query(50, ge=1, le=100, description="Max conversations to return"),
):
    """List recent conversations with readable titles, message counts, and last message previews."""
    return {
        "conversations": PersistenceService.list_conversations(
            user_id=user_id,
            analysis_id=analysis_id,
            limit=limit,
        )
    }


@app.post("/conversations", tags=["Conversation & RAG"])
def create_conversation_endpoint(req: CreateConversationSchema):
    """Explicitly create a new consultation conversation session without stale context."""
    cid = str(uuid.uuid4())
    mode = "analysis_aware" if req.analysis_id else (req.mode or "general")
    saved = PersistenceService.save_conversation(
        conversation_id=cid,
        user_id=req.user_id or "patient_user",
        mode=mode,
        analysis_id=req.analysis_id,
        title=req.title,
    )
    return saved


@app.get("/conversations/{conversation_id}", tags=["Conversation & RAG"])
@app.get("/conversation/{conversation_id}", tags=["Conversation & RAG"])
def get_conversation_history(conversation_id: str):
    """Retrieve full chronological conversation history with citations and metadata."""
    conv = PersistenceService.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail=f"Conversation '{conversation_id}' not found.")
    return conv


@app.patch("/conversations/{conversation_id}", tags=["Conversation & RAG"])
def update_conversation_title_endpoint(conversation_id: str, req: UpdateConversationSchema):
    """Rename an existing conversation title."""
    clean_title = req.title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Title cannot be empty.")
    success = PersistenceService.update_conversation_title(conversation_id, clean_title)
    if not success:
        raise HTTPException(status_code=404, detail=f"Conversation '{conversation_id}' not found.")
    return {"ok": True, "conversation_id": conversation_id, "title": clean_title}


@app.delete("/conversations/{conversation_id}", tags=["Conversation & RAG"])
def delete_conversation_endpoint(conversation_id: str):
    """Delete a conversation and its messages. Linked analyses are never deleted."""
    success = PersistenceService.delete_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Conversation '{conversation_id}' not found.")
    return {"ok": True, "deleted_conversation_id": conversation_id}


@app.post("/conversations/{conversation_id}/messages", tags=["Conversation & RAG"])
@app.post("/conversation/{conversation_id}/messages", tags=["Conversation & RAG"])
@app.post("/conversation", tags=["Conversation & RAG"])
def handle_conversation_turn(req: ConversationRequest, conversation_id: Optional[str] = None):
    """Unified conversational AI endpoint supporting both General Skin Health (Mode A)
    and Analysis-Aware Assistant (Mode B) with 8-node controlled workflow and RAG.
    """
    if conversation_id and not req.conversation_id:
        req.conversation_id = conversation_id
    active_query = req.query or req.message or ""
    if not active_query.strip():
        raise HTTPException(status_code=422, detail="Query or message field is required.")
    try:
        res = optiderma_workflow.run_turn(
            query=active_query,
            user_id=req.user_id,
            conversation_id=req.conversation_id,
            analysis_id=req.analysis_id,
            mode=req.mode or "patient",
        )
        return res
    except Exception as exc:
        logger.error(f"Conversation workflow failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Conversation turn failed: {exc}") from exc


@app.post("/analysis/{analysis_id}/chat", tags=["Conversation & RAG"])
def handle_analysis_chat(analysis_id: str, req: ConversationRequest):
    """Analysis-tied chat endpoint grounded in the specific persisted analysis ID."""
    req.analysis_id = analysis_id
    return handle_conversation_turn(req)


@app.post("/agent/voice-turn", tags=["Voice & Agent"])
async def agent_voice_turn_main(
    audio_file: Optional[UploadFile] = File(None, description="Recorded voice audio file"),
    image_file: Optional[UploadFile] = File(None, description="Optional dermoscopic image"),
    query: Optional[str] = Form(None, description="Optional text query or symptom notes"),
    analysis_id: Optional[str] = Form(None, description="Optional active analysis UUID"),
    conversation_id: Optional[str] = Form(None, description="Optional conversation session UUID"),
    user_id: Optional[str] = Form("patient_user", description="Patient identifier"),
    output_audio: bool = Form(True, description="Whether to generate MP3 speech synthesis"),
    response_format: Optional[str] = Query("json", description="'json' or 'audio'"),
):
    """Top-level unified voice-turn route."""
    from app.services.voice_turn_service import voice_turn_service

    audio_bytes = await audio_file.read() if audio_file else None
    fname = audio_file.filename if audio_file else "input.mp3"
    image_bytes = await image_file.read() if image_file else None

    result = voice_turn_service.process_voice_turn(
        audio_bytes=audio_bytes,
        audio_filename=fname,
        query_text=query,
        image_bytes=image_bytes,
        analysis_id=analysis_id,
        conversation_id=conversation_id,
        user_id=user_id,
        output_audio=output_audio,
    )

    if response_format and response_format.lower() == "audio" and result.get("raw_audio_bytes"):
        raw_audio = result["raw_audio_bytes"]
        return Response(
            content=raw_audio,
            media_type="audio/mpeg",
            headers={
                "X-Transcript": result.get("transcript", "")[:200],
                "X-Conversation-ID": result.get("conversation_id", ""),
                "X-Analysis-ID": result.get("analysis_id", "") or "",
                "X-Intent": result.get("intent", ""),
                "X-TTS-Provider": result.get("tts_provider", ""),
            },
        )

    result.pop("raw_audio_bytes", None)
    return result



@app.get("/analysis/{analysis_id}/conversations", tags=["Conversation & RAG"])
def get_analysis_conversations(analysis_id: str):
    """List all conversations associated with this analysis."""
    return {"conversations": PersistenceService.list_conversations(analysis_id=analysis_id)}


@app.get("/dermatologists/search", tags=["Care Connect"])
def search_dermatologists_endpoint(
    pin_code: Optional[str] = Query(None, description="6-digit postal PIN code"),
    district: Optional[str] = Query(None, description="District name"),
    city: Optional[str] = Query(None, description="City name"),
    consultation_type: Optional[str] = Query(None, description="'in-person' or 'teleconsult'"),
):
    """Search verified dermatology departments and clinics without fabricating providers."""
    clinics = search_dermatologists(
        pin_code=pin_code,
        district=district,
        city=city,
        consultation_type=consultation_type,
    )
    return {
        "results": clinics,
        "count": len(clinics),
        "search_parameters": {
            "pin_code": pin_code,
            "district": district,
            "city": city,
            "consultation_type": consultation_type,
        },
        "disclaimer": "All listed facilities are verified tertiary hospital dermatology departments or accredited centres. OptiDerma does not fabricate doctors or ratings.",
    }


@app.post("/appointments/request", tags=["Care Connect"])
def create_appointment_request(req: AppointmentRequestSchema):
    """Save an appointment request. Status is set to 'Pending' by default (never auto-confirmed)."""
    saved = PersistenceService.save_appointment_request(req.model_dump())
    return {
        "ok": True,
        "request": saved,
        "message": "Appointment request registered with status 'Pending'. A clinic coordinator will verify availability before confirmation.",
    }


@app.get("/appointments/requests", tags=["Care Connect"])
def list_appointment_requests_endpoint():
    """List all saved appointment requests with real status tracking."""
    requests = PersistenceService.list_appointment_requests()
    return {"requests": requests, "count": len(requests)}


@app.post("/analysis/{analysis_id}/consultation-summary", tags=["Care Connect"])
def get_consultation_summary_endpoint(analysis_id: str, req: ConsultationSummaryRequest):
    """Generate an honest, reviewable consultation preparation summary packet based on the analysis."""
    record = PersistenceService.get_analysis(analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Analysis ID '{analysis_id}' not found.")

    summary = generate_consultation_summary(
        analysis_record=record,
        user_questions=req.questions,
        user_notes=req.user_notes,
    )
    return summary


@app.get("/analysis/{analysis_id}/patient-summary", tags=["Patient Care"])
def get_patient_summary_endpoint(analysis_id: str):
    """Retrieve or dynamically generate the plain-language patient care summary."""
    record = PersistenceService.get_analysis(analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Analysis ID '{analysis_id}' not found.")

    if record.get("patient_summary"):
        return record["patient_summary"]

    from app.services.patient_care_service import generate_patient_care_summary
    summary = generate_patient_care_summary(record)
    return summary


@app.get("/persistence/status", tags=["Persistence"])
def get_persistence_status_endpoint():
    """Inspect Supabase cloud and local durable database status."""
    return PersistenceService.check_supabase_health()


@app.get("/", tags=["Root"])
def root():
    return {
        "title": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "health": "/health",
        "ready": "/ready",
        "predict": "/predict",
        "analyze": "/analyze",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
