import time
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.api.router import api_router
from app.config import settings
from app.utils.logger import logger

MAX_PAYLOAD_BYTES = 20 * 1024 * 1024  # 20 MB Limit
RATE_LIMIT_WINDOW = 60.0  # 60 seconds

# In-memory IP tracking bucket
_ip_request_timestamps = defaultdict(list)


class SecurityAndRateLimitMiddleware(BaseHTTPMiddleware):
    """Enforces Security Headers, Request Tracing, Payload Limits, and IP Rate Limiting."""

    async def dispatch(self, request: Request, call_next):
        # 1. Generate / attach X-Request-ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

        # 2. Enforce 20MB Payload Limit across all endpoints
        content_length = request.headers.get("Content-Length")
        if content_length and int(content_length) > MAX_PAYLOAD_BYTES:
            return JSONResponse(
                status_code=413,
                content={"error": "Payload Too Large", "message": "Request payload exceeds 20 MB limit."},
            )

        # Skip rate limit on health checks
        if request.url.path == "/api/v1/health" or request.url.path == "/":
            response: Response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline';"
            )
            return response

        # 3. Sliding Window IP Rate Limiting
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        timestamps = _ip_request_timestamps[client_ip]
        # Prune old timestamps
        _ip_request_timestamps[client_ip] = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]

        max_limit = getattr(settings, "RATE_LIMIT_PER_MINUTE", 300)
        if len(_ip_request_timestamps[client_ip]) >= max_limit:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return JSONResponse(
                status_code=429,
                content={"error": "Too Many Requests", "message": "Rate limit exceeded. Please wait a minute."},
            )

        _ip_request_timestamps[client_ip].append(now)

        # Process request
        response: Response = await call_next(request)

        # 4. Attach Security & Tracing Headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline';"
        )
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.PROJECT_NAME} (v{settings.VERSION}) in {settings.ENVIRONMENT} mode.")
    try:
        from app.services.inference_service import get_inference_pipeline
        get_inference_pipeline()
        logger.info("OptiDerma PyTorch model pipeline pre-warmed successfully.")
    except Exception as exc:
        logger.warning(f"Could not pre-warm model pipeline: {exc}")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Production-grade Multimodal Dermatology AI Decision Support System. "
        "Provides voice interface support, skin image finding abstractions, RAG evidence retrieval, "
        "and emergency safety red-flag triage."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Add Security, Tracing, Payload Limit & Rate Limit Middleware
app.add_middleware(SecurityAndRateLimitMiddleware)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler to log errors silently and prevent internal stack trace leakage."""
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


@app.get("/health", tags=["Inference"])
def health_check():
    """Health check endpoint for model inference client."""
    return {"ok": True}


@app.post("/predict", tags=["Inference"])
async def predict_lesion_endpoint(
    file: UploadFile = File(..., description="Dermoscopy image file (JPEG/PNG/WEBP)"),
    force: bool = Query(False, description="Skip quality check and force inference"),
    fov_mm: float = Query(15.0, description="Dermoscope field-of-view diameter in mm"),
):
    """Predict skin lesion characteristics using PyTorch pipeline or structured inference engine."""
    from app.services.inference_service import run_prediction

    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No image file provided in 'file' field")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    return run_prediction(image_bytes=raw, force=force, fov_mm=fov_mm)


@app.get("/", tags=["Root"])
def root():
    """Root redirect / information endpoint."""
    return {
        "title": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "api_v1": "/api/v1/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )

