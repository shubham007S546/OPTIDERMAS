"""OptiDerma Unified Inference & Multimodal Backend Server.

Delegates directly to the unified FastAPI application defined in backend/app/main.py,
providing a single unified server instance covering:
- GET  /health
- GET  /ready
- POST /predict
- POST /analyze
- GET  /analysis/{analysis_id}
- POST /analysis/{analysis_id}/verify
- GET  /analysis/{analysis_id}/report
- GET  /analysis/{analysis_id}/report/pdf
- API v1 sub-routers (/api/v1/health, /api/v1/voice/stt, /api/v1/voice/tts, /api/v1/rag)
"""
from __future__ import annotations

import sys
from pathlib import Path

# Add backend and model directories to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
MODEL_DIR = ROOT_DIR / "model"

for p in (str(BACKEND_DIR), str(MODEL_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from app.main import app  # noqa: E402, F401

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
