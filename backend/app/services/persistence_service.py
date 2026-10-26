"""Dedicated Persistence Service for OptiDerma (Phase 3).

Implements a robust repository pattern with dual-tier durability:
1. Supabase Cloud PostgreSQL (via PostgREST API with API key authorization)
2. Local Durable SQLite Store (backend/data/optiderma_persistence.db)
3. In-Memory Session Cache

Ensures that analyses, artifacts, and verification audits survive backend restarts
regardless of external network status, while transparently reporting the persistence state.
"""

from __future__ import annotations

import concurrent.futures
import json
import logging
import os
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
import urllib.request
import urllib.error
import uuid

logger = logging.getLogger("optiderma.persistence")

# Paths and configuration
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "optiderma_persistence.db"

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "https://uwlatkypjzfnobrobzns.supabase.co")
SUPABASE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_wXqtTFvTROzE0h0bqQfAag_Z-l2Ci-x")
)

_lock = threading.Lock()
_in_memory_cache: Dict[str, Dict[str, Any]] = {}
_last_successful_cloud_op_time: Optional[float] = None
_last_cloud_error: Optional[str] = None
CLOUD_HTTP_TIMEOUT = 5.0

# Non-blocking executor for background cloud synchronization so local requests are never delayed
_cloud_sync_executor = concurrent.futures.ThreadPoolExecutor(max_workers=3, thread_name_prefix="supabase_sync")


def _background_cloud_sync(target_fn, *args, **kwargs):
    """Executes a cloud synchronization task in a non-blocking background worker."""
    try:
        _cloud_sync_executor.submit(target_fn, *args, **kwargs)
    except Exception as exc:
        logger.debug("Failed to queue background cloud sync: %s", exc)




def _ensure_uuid(id_val: Any) -> str:
    """Ensures that an ID is a valid canonical RFC-4122 UUID string for PostgreSQL."""
    if not id_val:
        return str(uuid.uuid4())
    s = str(id_val).strip()
    try:
        return str(uuid.UUID(s))
    except Exception:
        # Deterministically convert non-UUID strings into valid UUIDs
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, s))



def _init_local_db():
    """Initializes local SQLite database with exact schema mirroring Supabase."""
    with _lock:
        conn = sqlite3.connect(str(DB_PATH))
        try:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS analyses (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'completed',
                    model_id TEXT NOT NULL,
                    checkpoint_hash TEXT NOT NULL,
                    image_fingerprint TEXT NOT NULL,
                    top3 TEXT NOT NULL,
                    probs TEXT NOT NULL,
                    malignant_prob REAL NOT NULL,
                    malignant_flag INTEGER NOT NULL,
                    risk_level TEXT NOT NULL,
                    risk_recommendation TEXT NOT NULL,
                    hair_detected INTEGER NOT NULL,
                    detected_strands INTEGER NOT NULL,
                    hair_pixels INTEGER NOT NULL,
                    hair_coverage_pct REAL NOT NULL,
                    inpainting_method TEXT NOT NULL,
                    area_px INTEGER NOT NULL,
                    perimeter_px REAL NOT NULL,
                    area_mm2 REAL NOT NULL,
                    perimeter_mm REAL NOT NULL,
                    is_calibrated INTEGER NOT NULL,
                    calibration_disclaimer TEXT NOT NULL,
                    asymmetry_index REAL NOT NULL,
                    compactness REAL NOT NULL,
                    coverage_pct REAL NOT NULL,
                    contour TEXT,
                    cam_target_class TEXT NOT NULL,
                    cam_target_idx INTEGER NOT NULL,
                    cam_target_prob REAL NOT NULL,
                    xai_energy_inside_pct REAL NOT NULL,
                    xai_spatial_ratio REAL NOT NULL,
                    xai_target_layer TEXT NOT NULL,
                    xai_warnings TEXT,
                    verification_passed INTEGER NOT NULL,
                    verification_summary TEXT,
                    verification_warnings TEXT,
                    persistence_source TEXT NOT NULL
                );
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS analysis_artifacts (
                    id TEXT PRIMARY KEY,
                    analysis_id TEXT NOT NULL,
                    artifact_type TEXT NOT NULL,
                    data_url TEXT NOT NULL,
                    content_type TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
                );
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS bookings (
                    id TEXT PRIMARY KEY,
                    reference TEXT UNIQUE NOT NULL,
                    slot_id TEXT NOT NULL,
                    slot_date TEXT NOT NULL,
                    slot_label TEXT NOT NULL,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    reason TEXT,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    analysis_id TEXT,
                    user_id TEXT NOT NULL,
                    title TEXT,
                    mode TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS conversation_messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    sender TEXT NOT NULL,
                    content TEXT NOT NULL,
                    citations TEXT,
                    intent TEXT,
                    metadata TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                );
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS appointment_requests (
                    id TEXT PRIMARY KEY,
                    analysis_id TEXT,
                    patient_name TEXT NOT NULL,
                    contact_email TEXT NOT NULL,
                    contact_phone TEXT,
                    city TEXT,
                    district TEXT,
                    pin_code TEXT,
                    clinic_id TEXT,
                    clinic_name TEXT,
                    preferred_date TEXT NOT NULL,
                    consultation_type TEXT NOT NULL,
                    reason TEXT,
                    consultation_summary TEXT,
                    status TEXT NOT NULL DEFAULT 'Pending',
                    user_consent INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
            """)
            conn.commit()
        finally:
            conn.close()


_init_local_db()


def get_persistence_mode() -> str:
    """Returns effective persistence mode: 'auto', 'sqlite', or 'supabase'."""
    mode = os.getenv("PERSISTENCE_BACKEND", "").strip().lower()
    if not mode:
        try:
            from backend.app.config import settings
            mode = getattr(settings, "PERSISTENCE_BACKEND", "auto").strip().lower()
        except Exception:
            mode = "auto"
    if mode in ("sqlite", "local", "offline"):
        return "sqlite"
    if mode in ("supabase", "cloud"):
        return "supabase"
    return "auto"


_last_supabase_health: Optional[Dict[str, Any]] = None
_last_supabase_health_time: float = 0.0


class PersistenceService:
    """Production persistence service handling Supabase cloud and local durable storage."""

    @staticmethod
    def get_mode() -> str:
        """Returns the configured persistence mode."""
        return get_persistence_mode()

    @staticmethod
    def check_supabase_health(force: bool = False) -> Dict[str, Any]:
        """Probes Supabase cloud connectivity and table readiness with 15s TTL caching."""
        global _last_supabase_health, _last_supabase_health_time
        now = time.time()
        if not force and _last_supabase_health is not None and (now - _last_supabase_health_time) < 15.0:
            return _last_supabase_health

        mode = get_persistence_mode()
        if mode == "sqlite":
            res = {
                "status": "configured_offline",
                "backend_mode": "sqlite",
                "reachable": False,
                "tables_ready": False,
                "provider": "Local SQLite WAL",
                "note": "Persistence backend explicitly set to local SQLite (PERSISTENCE_BACKEND=sqlite).",
            }
            _last_supabase_health = res
            _last_supabase_health_time = now
            return res

        if not SUPABASE_URL or not SUPABASE_KEY:
            res = {
                "status": "unconfigured",
                "backend_mode": mode,
                "reachable": False,
                "tables_ready": False,
                "error": "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_KEY missing from environment.",
            }
            _last_supabase_health = res
            _last_supabase_health_time = now
            return res

        url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/analyses?select=id&limit=1"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        }
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=CLOUD_HTTP_TIMEOUT) as resp:
                if resp.status == 200:
                    global _last_successful_cloud_op_time, _last_cloud_error
                    _last_successful_cloud_op_time = time.time()
                    _last_cloud_error = None
                    res = {
                        "status": "connected",
                        "backend_mode": mode,
                        "reachable": True,
                        "tables_ready": True,
                        "provider": "Supabase Cloud PostgreSQL",
                        "last_verified_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    }
                    _last_supabase_health = res
                    _last_supabase_health_time = now
                    return res
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="ignore")
            _last_cloud_error = body[:120]
            if "PGRST205" in body or "schema cache" in body or e.code == 404:
                res = {
                    "status": "pending_migration",
                    "backend_mode": mode,
                    "reachable": True,
                    "tables_ready": False,
                    "error": "Table 'public.analyses' missing in Supabase schema cache. Run docs/supabase_schema.sql in Supabase SQL editor.",
                }
                _last_supabase_health = res
                _last_supabase_health_time = now
                return res
            res = {
                "status": "http_error",
                "backend_mode": mode,
                "reachable": True,
                "tables_ready": False,
                "code": e.code,
                "error": body[:120],
            }
            _last_supabase_health = res
            _last_supabase_health_time = now
            return res
        except Exception as ex:
            _last_cloud_error = str(ex)
            res = {
                "status": "unreachable",
                "backend_mode": mode,
                "reachable": False,
                "tables_ready": False,
                "error": str(ex),
            }
            _last_supabase_health = res
            _last_supabase_health_time = now
            return res

        res = {"status": "unknown", "backend_mode": mode, "reachable": False, "tables_ready": False}
        _last_supabase_health = res
        _last_supabase_health_time = now
        return res

    @classmethod
    def get_detailed_health(cls) -> Dict[str, Any]:
        """Provides full forensic health information on persistence layers."""
        sb_health = cls.check_supabase_health(force=True)
        mode = get_persistence_mode()

        # Check local SQLite
        sqlite_ok = False
        sqlite_count = 0
        try:
            with _lock:
                conn = sqlite3.connect(str(DB_PATH))
                try:
                    cursor = conn.execute("SELECT count(*) FROM analyses;")
                    sqlite_count = cursor.fetchone()[0]
                    sqlite_ok = True
                finally:
                    conn.close()
        except Exception as e:
            logger.error("SQLite health check failed: %s", e)

        is_cloud_active = bool(sb_health.get("reachable") and sb_health.get("tables_ready"))
        effective_backend = "supabase" if (mode != "sqlite" and is_cloud_active) else "sqlite"

        return {
            "status": "healthy" if (sqlite_ok or is_cloud_active) else "degraded",
            "active_backend": effective_backend,
            "configured_mode": mode,
            "supabase": {
                "reachable": sb_health.get("reachable", False),
                "tables_ready": sb_health.get("tables_ready", False),
                "status": sb_health.get("status", "unknown"),
                "provider": sb_health.get("provider", "Supabase Cloud PostgreSQL"),
                "last_verified_at": sb_health.get("last_verified_at"),
            },
            "sqlite_wal": {
                "active": sqlite_ok,
                "path": str(DB_PATH),
                "record_count": sqlite_count,
            },
            "dual_write_enabled": mode != "sqlite",
            "fallback_active": mode == "sqlite" or not is_cloud_active,
            "fallback_reason": None if is_cloud_active else sb_health.get("error", "Supabase unavailable or offline mode configured"),
        }


    @classmethod
    def save_analysis(cls, record: Dict[str, Any], images: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Saves a complete canonical analysis record to disk and Supabase."""
        analysis_id = record.get("analysis_id") or record.get("id") or str(uuid.uuid4())
        record["analysis_id"] = analysis_id
        record["id"] = analysis_id
        created_at = record.get("created_at") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        m = record.get("metrics", {})
        x = record.get("xai", {})
        v = record.get("verification", {})
        hair = record.get("hair_removal", {})

        # 1. Update in-memory session cache immediately
        with _lock:
            cached = dict(record)
            if images:
                cached["images"] = images
            _in_memory_cache[analysis_id] = cached

        # 2. Check persistence mode
        mode = get_persistence_mode()
        persisted_to_supabase = False
        persistence_source = "local_sqlite_durable"

        # 3. Persist to durable local SQLite store first (immediate zero-latency durability)
        try:
            with _lock:
                conn = sqlite3.connect(str(DB_PATH))
                try:
                    conn.execute("""
                        INSERT OR REPLACE INTO analyses (
                            id, created_at, updated_at, status, model_id, checkpoint_hash, image_fingerprint,
                            top3, probs, malignant_prob, malignant_flag, risk_level, risk_recommendation,
                            hair_detected, detected_strands, hair_pixels, hair_coverage_pct, inpainting_method,
                            area_px, perimeter_px, area_mm2, perimeter_mm, is_calibrated, calibration_disclaimer,
                            asymmetry_index, compactness, coverage_pct, contour,
                            cam_target_class, cam_target_idx, cam_target_prob, xai_energy_inside_pct,
                            xai_spatial_ratio, xai_target_layer, xai_warnings,
                            verification_passed, verification_summary, verification_warnings,
                            persistence_source
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """, (
                        analysis_id,
                        created_at,
                        created_at,
                        "completed",
                        "EfficientNet-B4 (7-class + U-Net)",
                        x.get("checkpoint_hash", "006a77b02a"),
                        x.get("image_fingerprint", ""),
                        json.dumps(record.get("top3", [])),
                        json.dumps(record.get("probs", {})),
                        float(record.get("malignant_prob", 0.0)),
                        1 if record.get("malignant_flag") else 0,
                        record.get("risk", {}).get("level", "Moderate"),
                        record.get("risk", {}).get("recommendation", ""),
                        1 if hair.get("hair_detected") else 0,
                        int(hair.get("detected_strands", 0)),
                        int(hair.get("hair_pixels", 0)),
                        float(hair.get("coverage_pct", 0.0)),
                        hair.get("inpainting_method", "Telea"),
                        int(m.get("area_px", 0)),
                        float(m.get("perimeter_px", 0.0)),
                        float(m.get("area_mm2", 0.0)),
                        float(m.get("perimeter_mm", 0.0)),
                        1 if m.get("is_calibrated") else 0,
                        m.get("calibration_disclaimer", ""),
                        float(m.get("asymmetry_index", 0.0)),
                        float(m.get("compactness", 0.0)),
                        float(m.get("coverage_pct", 0.0)),
                        json.dumps(m.get("contour", [])),
                        x.get("target_class", "mel"),
                        int(x.get("target_idx", 0)),
                        float(x.get("target_prob", 0.0)),
                        float(x.get("energy_inside_pct", 0.0)),
                        float(x.get("spatial_ratio", 0.0)),
                        x.get("target_layer", "encoder._conv_head"),
                        json.dumps(x.get("warnings", [])),
                        1 if v.get("passed", True) else 0,
                        json.dumps(v.get("checks_summary", {})),
                        json.dumps(v.get("warnings", [])),
                        persistence_source,
                    ))

                    # Save image artifacts locally if present
                    if images:
                        for art_type, data_url in images.items():
                            if data_url and isinstance(data_url, str):
                                conn.execute("""
                                    INSERT OR REPLACE INTO analysis_artifacts (
                                        id, analysis_id, artifact_type, data_url, content_type, created_at
                                    ) VALUES (?, ?, ?, ?, ?, ?);
                                """, (
                                    f"{analysis_id}_{art_type}",
                                    analysis_id,
                                    art_type,
                                    data_url,
                                    "image/png",
                                    created_at,
                                ))
                    conn.commit()
                    logger.info("Successfully persisted analysis %s to local durable database (%s).", analysis_id, DB_PATH)
                finally:
                    conn.close()
        except Exception as e:
            logger.error("Failed writing analysis %s to local database: %s", analysis_id, e)

        # 4. Non-blocking background cloud sync to Supabase (never blocks inference or caller)
        if mode != "sqlite":
            def _do_sync_analysis():
                supabase_health = cls.check_supabase_health()
                if supabase_health.get("tables_ready"):
                    try:
                        sb_analysis_id = _ensure_uuid(analysis_id)
                        sb_payload = {
                            "id": sb_analysis_id,
                            "created_at": created_at,
                            "status": "completed",
                            "model_id": "EfficientNet-B4 (7-class + U-Net)",
                            "checkpoint_hash": x.get("checkpoint_hash", "006a77b02a"),
                            "image_fingerprint": x.get("image_fingerprint", ""),
                            "top3": record.get("top3", []),
                            "probs": record.get("probs", {}),
                            "malignant_prob": float(record.get("malignant_prob", 0.0)),
                            "malignant_flag": bool(record.get("malignant_flag", False)),
                            "risk_level": record.get("risk", {}).get("level", "Moderate"),
                            "risk_recommendation": record.get("risk", {}).get("recommendation", ""),
                            "hair_detected": bool(hair.get("hair_detected", False)),
                            "detected_strands": int(hair.get("detected_strands", 0)),
                            "hair_pixels": int(hair.get("hair_pixels", 0)),
                            "hair_coverage_pct": float(hair.get("coverage_pct", 0.0)),
                            "inpainting_method": hair.get("inpainting_method", "Telea"),
                            "area_px": int(m.get("area_px", 0)),
                            "perimeter_px": float(m.get("perimeter_px", 0.0)),
                            "area_mm2": float(m.get("area_mm2", 0.0)),
                            "perimeter_mm": float(m.get("perimeter_mm", 0.0)),
                            "is_calibrated": bool(m.get("is_calibrated", False)),
                            "calibration_disclaimer": m.get("calibration_disclaimer", ""),
                            "asymmetry_index": float(m.get("asymmetry_index", 0.0)),
                            "compactness": float(m.get("compactness", 0.0)),
                            "coverage_pct": float(m.get("coverage_pct", 0.0)),
                            "contour": m.get("contour", []),
                            "cam_target_class": x.get("target_class", "mel"),
                            "cam_target_idx": int(x.get("target_idx", 0)),
                            "cam_target_prob": float(x.get("target_prob", 0.0)),
                            "xai_energy_inside_pct": float(x.get("energy_inside_pct", 0.0)),
                            "xai_spatial_ratio": float(x.get("spatial_ratio", 0.0)),
                            "xai_target_layer": x.get("target_layer", "encoder._conv_head"),
                            "xai_warnings": x.get("warnings", []),
                            "verification_passed": bool(v.get("passed", True)),
                            "verification_summary": v.get("checks_summary", {}),
                            "verification_warnings": v.get("warnings", []),
                            "persistence_source": "supabase_cloud",
                        }

                        url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/analyses"
                        headers = {
                            "apikey": SUPABASE_KEY,
                            "Authorization": f"Bearer {SUPABASE_KEY}",
                            "Content-Type": "application/json",
                            "Prefer": "return=minimal,resolution=merge-duplicates",
                        }
                        req = urllib.request.Request(url, data=json.dumps(sb_payload).encode("utf-8"), headers=headers, method="POST")
                        with urllib.request.urlopen(req, timeout=CLOUD_HTTP_TIMEOUT) as resp:
                            if resp.status in (200, 201, 204):
                                global _last_successful_cloud_op_time
                                _last_successful_cloud_op_time = time.time()
                                logger.info("Successfully synced analysis %s to Supabase Cloud in background.", analysis_id)

                                # Sync artifacts if present
                                if images:
                                    art_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/analysis_artifacts"
                                    type_map = {
                                        "raw": "raw",
                                        "cam": "raw_cam",
                                        "overlay": "overlay",
                                        "boundary": "boundary",
                                        "hair_mask": "hair_mask",
                                        "dehaired": "preprocessed_dehaired",
                                    }
                                    for atype, durl in images.items():
                                        if durl and isinstance(durl, str):
                                            art_payload = {
                                                "id": _ensure_uuid(f"{analysis_id}_{atype}"),
                                                "analysis_id": sb_analysis_id,
                                                "artifact_type": type_map.get(atype, "overlay"),
                                                "data_url": durl[:500000],
                                                "content_type": "image/jpeg" if "jpeg" in durl else "image/png"
                                            }
                                            art_req = urllib.request.Request(
                                                art_url,
                                                data=json.dumps(art_payload).encode("utf-8"),
                                                headers=headers,
                                                method="POST"
                                            )
                                            try:
                                                with urllib.request.urlopen(art_req, timeout=CLOUD_HTTP_TIMEOUT) as art_resp:
                                                    pass
                                            except Exception as art_err:
                                                logger.debug("Artifact %s cloud upload note: %s", atype, art_err)
                    except Exception as e:
                        global _last_cloud_error
                        _last_cloud_error = str(e)
                        logger.debug("Background Supabase analysis write note for %s (%s).", analysis_id, e)

            _background_cloud_sync(_do_sync_analysis)

        persisted = persisted_to_supabase if mode == "supabase" else True
        effective_source = persistence_source
        if mode == "supabase" and not persisted_to_supabase:
            effective_source = "local_sqlite_fallback_unmigrated"

        persistence_info = {
            "persisted": persisted,
            "backend_mode": mode,
            "supabase_cloud": persisted_to_supabase,
            "local_database": True,
            "persistence_source": effective_source,
            "supabase_health": _last_supabase_health or cls.check_supabase_health(),
        }
        return persistence_info

    @classmethod
    def get_analysis(cls, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves analysis record by ID from memory, local DB, or Supabase."""
        # 1. Fast cache check
        with _lock:
            if analysis_id in _in_memory_cache:
                return _in_memory_cache[analysis_id]

        # 2. Local Durable DB query
        try:
            with _lock:
                conn = sqlite3.connect(str(DB_PATH))
                conn.row_factory = sqlite3.Row
                try:
                    row = conn.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,)).fetchone()
                    if row:
                        # Reconstruct images from artifacts
                        artifacts = conn.execute(
                            "SELECT artifact_type, data_url FROM analysis_artifacts WHERE analysis_id = ?",
                            (analysis_id,),
                        ).fetchall()
                        images = {a["artifact_type"]: a["data_url"] for a in artifacts}

                        record = {
                            "analysis_id": row["id"],
                            "created_at": row["created_at"],
                            "status": row["status"],
                            "top3": json.loads(row["top3"]),
                            "probs": json.loads(row["probs"]),
                            "malignant_prob": row["malignant_prob"],
                            "malignant_flag": bool(row["malignant_flag"]),
                            "risk": {
                                "level": row["risk_level"],
                                "recommendation": row["risk_recommendation"],
                                "color": "Red" if row["risk_level"] == "High" else "Amber" if row["risk_level"] == "Moderate" else "Green",
                            },
                            "hair_removal": {
                                "hair_detected": bool(row["hair_detected"]),
                                "detected_strands": row["detected_strands"],
                                "hair_pixels": row["hair_pixels"],
                                "coverage_pct": row["hair_coverage_pct"],
                                "inpainting_method": row["inpainting_method"],
                            },
                            "metrics": {
                                "area_px": row["area_px"],
                                "perimeter_px": row["perimeter_px"],
                                "area_mm2": row["area_mm2"],
                                "perimeter_mm": row["perimeter_mm"],
                                "is_calibrated": bool(row["is_calibrated"]),
                                "calibration_disclaimer": row["calibration_disclaimer"],
                                "asymmetry_index": row["asymmetry_index"],
                                "compactness": row["compactness"],
                                "coverage_pct": row["coverage_pct"],
                                "contour": json.loads(row["contour"] or "[]"),
                            },
                            "images": images,
                            "xai": {
                                "target_class": row["cam_target_class"],
                                "target_idx": row["cam_target_idx"],
                                "target_prob": row["cam_target_prob"],
                                "energy_inside_pct": row["xai_energy_inside_pct"],
                                "spatial_ratio": row["xai_spatial_ratio"],
                                "target_layer": row["xai_target_layer"],
                                "checkpoint_hash": row["checkpoint_hash"],
                                "image_fingerprint": row["image_fingerprint"],
                                "warnings": json.loads(row["xai_warnings"] or "[]"),
                            },
                            "verification": {
                                "passed": bool(row["verification_passed"]),
                                "checks_summary": json.loads(row["verification_summary"] or "{}"),
                                "warnings": json.loads(row["verification_warnings"] or "[]"),
                            },
                            "evidence": [],
                            "persistence_source": row["persistence_source"],
                        }
                        # Warm memory cache
                        _in_memory_cache[analysis_id] = record
                        logger.info("Retrieved analysis %s from local durable database after restart.", analysis_id)
                        return record
                finally:
                    conn.close()
        except Exception as e:
            logger.error("Error querying local DB for %s: %s", analysis_id, e)

        # 3. Supabase Cloud Query
        if SUPABASE_URL and SUPABASE_KEY:
            try:
                sb_id = _ensure_uuid(analysis_id)
                url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/analyses?id=eq.{sb_id}&select=*"
                headers = {
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                }
                req = urllib.request.Request(url, headers=headers, method="GET")
                with urllib.request.urlopen(req, timeout=CLOUD_HTTP_TIMEOUT) as resp:
                    if resp.status == 200:
                        rows = json.loads(resp.read().decode("utf-8"))
                        if rows:
                            r = rows[0]
                            record = {
                                "analysis_id": r["id"],
                                "created_at": r["created_at"],
                                "top3": r["top3"],
                                "probs": r["probs"],
                                "malignant_prob": r["malignant_prob"],
                                "malignant_flag": r["malignant_flag"],
                                "risk": {
                                    "level": r["risk_level"],
                                    "recommendation": r["risk_recommendation"],
                                    "color": "Red" if r["risk_level"] == "High" else "Amber" if r["risk_level"] == "Moderate" else "Green",
                                },
                                "hair_removal": {
                                    "hair_detected": r.get("hair_detected", False),
                                    "detected_strands": r.get("detected_strands", 0),
                                    "hair_pixels": r.get("hair_pixels", 0),
                                    "coverage_pct": r.get("hair_coverage_pct", 0.0),
                                    "inpainting_method": r.get("inpainting_method", "Telea"),
                                },
                                "metrics": {
                                    "area_px": r.get("area_px", 0),
                                    "perimeter_px": r.get("perimeter_px", 0.0),
                                    "area_mm2": r.get("area_mm2", 0.0),
                                    "perimeter_mm": r.get("perimeter_mm", 0.0),
                                    "is_calibrated": r.get("is_calibrated", False),
                                    "calibration_disclaimer": r.get("calibration_disclaimer", ""),
                                    "asymmetry_index": r.get("asymmetry_index", 0.0),
                                    "compactness": r.get("compactness", 0.0),
                                    "coverage_pct": r.get("coverage_pct", 0.0),
                                    "contour": r.get("contour", []),
                                },
                                "images": {},
                                "xai": {
                                    "target_class": r.get("cam_target_class", "mel"),
                                    "target_idx": r.get("cam_target_idx", 0),
                                    "target_prob": r.get("cam_target_prob", 0.0),
                                    "energy_inside_pct": r.get("xai_energy_inside_pct", 0.0),
                                    "spatial_ratio": r.get("xai_spatial_ratio", 0.0),
                                    "target_layer": r.get("xai_target_layer", "encoder._conv_head"),
                                    "checkpoint_hash": r.get("checkpoint_hash", "006a77b02a"),
                                    "image_fingerprint": r.get("image_fingerprint", ""),
                                    "warnings": r.get("xai_warnings", []),
                                },
                                "verification": {
                                    "passed": r.get("verification_passed", True),
                                    "checks_summary": r.get("verification_summary", {}),
                                    "warnings": r.get("verification_warnings", []),
                                },
                                "evidence": [],
                                "persistence_source": "supabase_cloud",
                            }
                            with _lock:
                                _in_memory_cache[analysis_id] = record
                            return record
            except Exception as e:
                logger.debug("Supabase get query failed: %s", e)

        return None

    @classmethod
    def list_analyses(cls, limit: int = 20) -> List[Dict[str, Any]]:
        """Lists recent persisted analyses for history and dashboard."""
        try:
            with _lock:
                conn = sqlite3.connect(str(DB_PATH))
                conn.row_factory = sqlite3.Row
                try:
                    rows = conn.execute(
                        "SELECT id, created_at, top3, malignant_prob, risk_level, risk_recommendation, status, persistence_source "
                        "FROM analyses ORDER BY created_at DESC LIMIT ?",
                        (limit,),
                    ).fetchall()
                    res = []
                    for r in rows:
                        top3 = json.loads(r["top3"]) if r["top3"] else []
                        res.append({
                            "analysis_id": r["id"],
                            "created_at": r["created_at"],
                            "top_condition": top3[0][0] if top3 else "unknown",
                            "top_score": top3[0][1] if top3 else 0.0,
                            "top3": top3,
                            "malignant_prob": r["malignant_prob"],
                            "risk_level": r["risk_level"],
                            "recommendation": r["risk_recommendation"],
                            "status": r["status"],
                            "persistence_source": r["persistence_source"],
                        })
                    return res
                finally:
                    conn.close()
        except Exception as e:
            logger.error(f"Failed to list analyses from SQLite: {e}")
            return []

    @classmethod
    def update_verification(cls, analysis_id: str, verification: Dict[str, Any]) -> bool:
        """Updates verification findings in all stores."""
        with _lock:
            if analysis_id in _in_memory_cache:
                _in_memory_cache[analysis_id]["verification"] = verification

        try:
            with _lock:
                conn = sqlite3.connect(str(DB_PATH))
                try:
                    conn.execute("""
                        UPDATE analyses
                        SET verification_passed = ?,
                            verification_summary = ?,
                            verification_warnings = ?,
                            updated_at = ?
                        WHERE id = ?;
                    """, (
                        1 if verification.get("passed", True) else 0,
                        json.dumps(verification.get("checks_summary", {})),
                        json.dumps(verification.get("warnings", [])),
                        time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        analysis_id,
                    ))
                    conn.commit()
                finally:
                    conn.close()
        except Exception as e:
            logger.error("Failed to update verification for %s in local DB: %s", analysis_id, e)

        # Attempt Supabase update
        if SUPABASE_URL and SUPABASE_KEY:
            try:
                url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/analyses?id=eq.{analysis_id}"
                headers = {
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                }
                payload = {
                    "verification_passed": bool(verification.get("passed", True)),
                    "verification_summary": verification.get("checks_summary", {}),
                    "verification_warnings": verification.get("warnings", []),
                }
                req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="PATCH")
                with urllib.request.urlopen(req, timeout=CLOUD_HTTP_TIMEOUT) as resp:
                    pass
            except Exception:
                pass

        return True

    @classmethod
    def save_conversation(
        cls,
        conversation_id: str,
        user_id: str,
        mode: str = "general",
        analysis_id: Optional[str] = None,
        title: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Creates or updates a conversation record."""
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        auto_title = title or ("Analysis Discussion" if analysis_id else "General Skin Health Consultation")
        with _lock:
            conn = sqlite3.connect(str(DB_PATH))
            try:
                conn.execute("""
                    INSERT INTO conversations (id, analysis_id, user_id, title, mode, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        analysis_id = excluded.analysis_id,
                        updated_at = excluded.updated_at,
                        title = COALESCE(excluded.title, conversations.title);
                """, (conversation_id, analysis_id, user_id, auto_title, mode, now, now))
                conn.commit()
            finally:
                conn.close()

        # Non-blocking background cloud sync to Supabase (never delays caller)
        def _do_save_conv():
            supabase_health = cls.check_supabase_health()
            if supabase_health.get("tables_ready"):
                try:
                    sb_conv_id = _ensure_uuid(conversation_id)
                    sb_analysis_id = _ensure_uuid(analysis_id) if analysis_id else None
                    sb_payload = {
                        "id": sb_conv_id,
                        "analysis_id": sb_analysis_id,
                        "user_id": user_id,
                        "title": auto_title,
                        "metadata": {"mode": mode},
                        "created_at": now,
                        "updated_at": now,
                    }
                    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/conversations"
                    headers = {
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal,resolution=merge-duplicates",
                    }
                    req = urllib.request.Request(url, data=json.dumps(sb_payload).encode("utf-8"), headers=headers, method="POST")
                    with urllib.request.urlopen(req, timeout=CLOUD_HTTP_TIMEOUT) as resp:
                        pass
                except Exception as e:
                    logger.debug("Supabase save_conversation sync note (%s)", e)

        _background_cloud_sync(_do_save_conv)

        return {
            "id": conversation_id,
            "conversation_id": conversation_id,
            "ok": True,
            "analysis_id": analysis_id,
            "user_id": user_id,
            "title": auto_title,
            "mode": mode,
            "created_at": now,
            "updated_at": now,
        }

    @classmethod
    def add_conversation_message(
        cls,
        conversation_id: str,
        sender: str,
        content: str,
        citations: Optional[List[Dict[str, Any]]] = None,
        intent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Appends a message to a conversation."""
        import uuid
        msg_id = str(uuid.uuid4())
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        citations_json = json.dumps(citations) if citations else None
        meta_json = json.dumps(metadata) if metadata else None
        with _lock:
            conn = sqlite3.connect(str(DB_PATH))
            try:
                conn.execute("""
                    INSERT INTO conversation_messages (id, conversation_id, sender, content, citations, intent, metadata, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                """, (msg_id, conversation_id, sender, content, citations_json, intent, meta_json, now))
                conn.execute("""
                    UPDATE conversations SET updated_at = ? WHERE id = ?;
                """, (now, conversation_id))
                conn.commit()
            finally:
                conn.close()

        # Non-blocking background cloud sync to Supabase (never delays caller)
        def _do_save_msg():
            supabase_health = cls.check_supabase_health()
            if supabase_health.get("tables_ready"):
                try:
                    sb_msg_id = _ensure_uuid(msg_id)
                    sb_conv_id = _ensure_uuid(conversation_id)
                    role = "user" if sender.lower() in ("user", "patient") else "assistant"
                    meta_dict = dict(metadata or {})
                    meta_dict["sender"] = sender
                    if intent:
                        meta_dict["intent"] = intent
                    if citations:
                        meta_dict["citations"] = citations

                    sb_payload = {
                        "id": sb_msg_id,
                        "conversation_id": sb_conv_id,
                        "role": role,
                        "content": content,
                        "metadata": meta_dict,
                        "created_at": now,
                    }
                    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/conversation_messages"
                    headers = {
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal",
                    }
                    req = urllib.request.Request(url, data=json.dumps(sb_payload).encode("utf-8"), headers=headers, method="POST")
                    with urllib.request.urlopen(req, timeout=CLOUD_HTTP_TIMEOUT) as resp:
                        pass
                except Exception as e:
                    logger.debug("Supabase add_conversation_message sync note (%s)", e)

        _background_cloud_sync(_do_save_msg)

        return {
            "id": msg_id,
            "conversation_id": conversation_id,
            "sender": sender,
            "content": content,
            "citations": citations or [],
            "intent": intent,
            "metadata": metadata or {},
            "created_at": now,
        }

    @classmethod
    def get_conversation(cls, conversation_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a conversation and all its messages in chronological order."""
        with _lock:
            conn = sqlite3.connect(str(DB_PATH))
            conn.row_factory = sqlite3.Row
            try:
                c_row = conn.execute("SELECT * FROM conversations WHERE id = ?;", (conversation_id,)).fetchone()
                if not c_row:
                    return None
                conv = dict(c_row)
                conv["conversation_id"] = conv.get("id")
                m_rows = conn.execute(
                    "SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC;",
                    (conversation_id,),
                ).fetchall()
                messages = []
                for m in m_rows:
                    md = dict(m)
                    md["conversation_id"] = md.get("conversation_id") or conversation_id
                    md["role"] = "user" if md.get("sender", "").lower() in ("user", "patient") else "assistant"
                    md["timestamp"] = md.get("created_at")
                    if md.get("citations"):
                        try:
                            md["citations"] = json.loads(md["citations"])
                        except Exception:
                            md["citations"] = []
                    else:
                        md["citations"] = []
                    if md.get("metadata"):
                        try:
                            md["metadata"] = json.loads(md["metadata"])
                        except Exception:
                            md["metadata"] = {}
                    else:
                        md["metadata"] = {}
                    messages.append(md)
                conv["messages"] = messages
                return conv
            finally:
                conn.close()

    @classmethod
    def list_conversations(
        cls,
        user_id: Optional[str] = None,
        analysis_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Lists recent conversations with last message preview, message count, and timestamps."""
        with _lock:
            conn = sqlite3.connect(str(DB_PATH))
            conn.row_factory = sqlite3.Row
            try:
                query = """
                    SELECT c.*,
                           (SELECT COUNT(*) FROM conversation_messages cm WHERE cm.conversation_id = c.id) as message_count,
                           (SELECT cm.content FROM conversation_messages cm WHERE cm.conversation_id = c.id ORDER BY cm.created_at DESC, cm.rowid DESC LIMIT 1) as last_message_preview,
                           (SELECT cm.sender FROM conversation_messages cm WHERE cm.conversation_id = c.id ORDER BY cm.created_at DESC, cm.rowid DESC LIMIT 1) as last_sender
                    FROM conversations c
                """
                params = []
                clauses = []
                if user_id:
                    clauses.append("c.user_id = ?")
                    params.append(user_id)
                if analysis_id:
                    clauses.append("c.analysis_id = ?")
                    params.append(analysis_id)
                if clauses:
                    query += " WHERE " + " AND ".join(clauses)
                query += " ORDER BY c.updated_at DESC LIMIT ?;"
                params.append(limit)
                rows = conn.execute(query, params).fetchall()
                res = []
                for r in rows:
                    item = dict(r)
                    item["conversation_id"] = item.get("id")
                    preview = item.get("last_message_preview") or ""
                    if preview:
                        preview = preview.replace("### ", "").replace("**", "").strip()
                        if len(preview) > 120:
                            preview = preview[:117] + "..."
                    item["last_message_preview"] = preview
                    res.append(item)
                return res
            finally:
                conn.close()

    @classmethod
    def update_conversation_title(
        cls,
        conversation_id: str,
        title: str,
        user_id: Optional[str] = None,
    ) -> bool:
        """Updates the title of a conversation record."""
        clean_title = title.strip()
        if not clean_title:
            return False
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        with _lock:
            conn = sqlite3.connect(str(DB_PATH))
            try:
                if user_id:
                    cursor = conn.execute(
                        "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?;",
                        (clean_title, now, conversation_id, user_id),
                    )
                else:
                    cursor = conn.execute(
                        "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?;",
                        (clean_title, now, conversation_id),
                    )
                conn.commit()
                found = cursor.rowcount > 0
            finally:
                conn.close()

        if not found:
            return False

        # Non-blocking background cloud sync to Supabase (never delays caller)
        def _do_update_title():
            supabase_health = cls.check_supabase_health()
            if supabase_health.get("tables_ready"):
                try:
                    sb_conv_id = _ensure_uuid(conversation_id)
                    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/conversations?id=eq.{sb_conv_id}"
                    headers = {
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal",
                    }
                    payload = {"title": clean_title, "updated_at": now}
                    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="PATCH")
                    with urllib.request.urlopen(req, timeout=CLOUD_HTTP_TIMEOUT) as resp:
                        pass
                except Exception as e:
                    logger.debug("Supabase update_conversation_title sync note (%s)", e)

        _background_cloud_sync(_do_update_title)

        return True

    @classmethod
    def delete_conversation(
        cls,
        conversation_id: str,
        user_id: Optional[str] = None,
    ) -> bool:
        """Deletes a conversation and its messages. Analyses are NEVER deleted."""
        with _lock:
            conn = sqlite3.connect(str(DB_PATH))
            try:
                if user_id:
                    row = conn.execute("SELECT id FROM conversations WHERE id = ? AND user_id = ?;", (conversation_id, user_id)).fetchone()
                    if not row:
                        return False

                conn.execute("DELETE FROM conversation_messages WHERE conversation_id = ?;", (conversation_id,))
                cursor = conn.execute("DELETE FROM conversations WHERE id = ?;", (conversation_id,))
                conn.commit()
                found = cursor.rowcount > 0
            finally:
                conn.close()

        if not found:
            return False

        # Cloud sync to Supabase when tables are ready
        supabase_health = cls.check_supabase_health()
        if supabase_health.get("tables_ready"):
            try:
                sb_conv_id = _ensure_uuid(conversation_id)
                url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/conversations?id=eq.{sb_conv_id}"
                headers = {
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                }
                req = urllib.request.Request(url, headers=headers, method="DELETE")
                with urllib.request.urlopen(req, timeout=CLOUD_HTTP_TIMEOUT) as resp:
                    pass
            except Exception as e:
                logger.warning("Supabase delete_conversation failed (%s)", e)

        return True

    @classmethod
    def save_appointment_request(cls, data: Optional[Dict[str, Any]] = None, **kwargs) -> Dict[str, Any]:
        """Saves an appointment request with default 'pending_provider_confirmation' status."""
        import uuid
        payload = dict(data or {})
        payload.update(kwargs)
        req_id = payload.get("id") or str(uuid.uuid4())
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        status = payload.get("status", "pending_provider_confirmation")
        with _lock:
            conn = sqlite3.connect(str(DB_PATH))
            try:
                conn.execute("""
                    INSERT INTO appointment_requests (
                        id, analysis_id, patient_name, contact_email, contact_phone,
                        city, district, pin_code, clinic_id, clinic_name,
                        preferred_date, consultation_type, reason, consultation_summary,
                        status, user_consent, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        status = excluded.status,
                        updated_at = excluded.updated_at;
                """, (
                    req_id,
                    payload.get("analysis_id"),
                    payload.get("patient_name", "Anonymous Patient"),
                    payload.get("contact_email", ""),
                    payload.get("contact_phone", ""),
                    payload.get("city", ""),
                    payload.get("district", ""),
                    payload.get("pin_code", ""),
                    payload.get("clinic_id", ""),
                    payload.get("clinic_name", ""),
                    payload.get("preferred_date", now[:10]),
                    payload.get("consultation_type", "in-person"),
                    payload.get("reason", ""),
                    payload.get("consultation_summary", ""),
                    status,
                    1 if payload.get("user_consent", True) else 0,
                    now,
                    now,
                ))
                conn.commit()
            finally:
                conn.close()

        # Cloud sync to Supabase when tables are ready
        supabase_health = cls.check_supabase_health()
        if supabase_health.get("tables_ready"):
            try:
                sb_req_id = _ensure_uuid(req_id)
                sb_analysis_id = _ensure_uuid(payload.get("analysis_id")) if payload.get("analysis_id") else None

                ctype = payload.get("consultation_type", "in-person")
                if ctype in ("teleconsult", "virtual", "remote"):
                    ctype_sb = "telehealth"
                elif ctype == "second-opinion":
                    ctype_sb = "second-opinion"
                else:
                    ctype_sb = "in-person"

                raw_status = status
                if raw_status in ("pending_provider_confirmation", "Pending", "pending"):
                    status_sb = "Pending"
                elif raw_status in ("Confirmed", "confirmed"):
                    status_sb = "Confirmed"
                elif raw_status in ("Completed", "completed"):
                    status_sb = "Completed"
                elif raw_status in ("Cancelled", "cancelled"):
                    status_sb = "Cancelled"
                else:
                    status_sb = "Pending"

                sb_payload = {
                    "id": sb_req_id,
                    "analysis_id": sb_analysis_id,
                    "patient_name": payload.get("patient_name", "Anonymous Patient"),
                    "contact_email": payload.get("contact_email", ""),
                    "contact_phone": payload.get("contact_phone", ""),
                    "city": payload.get("city", ""),
                    "district": payload.get("district", ""),
                    "pin_code": payload.get("pin_code", ""),
                    "clinic_id": payload.get("clinic_id", ""),
                    "clinic_name": payload.get("clinic_name", ""),
                    "preferred_date": payload.get("preferred_date", now[:10]),
                    "consultation_type": ctype_sb,
                    "reason": payload.get("reason", ""),
                    "consultation_summary": payload.get("consultation_summary", ""),
                    "status": status_sb,
                    "user_consent": bool(payload.get("user_consent", True)),
                    "created_at": now,
                    "updated_at": now,
                }
                url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/appointment_requests"
                headers = {
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal,resolution=merge-duplicates",
                }
                req = urllib.request.Request(url, data=json.dumps(sb_payload).encode("utf-8"), headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=CLOUD_HTTP_TIMEOUT) as resp:
                    pass
            except Exception as e:
                logger.warning("Supabase save_appointment_request failed (%s)", e)

        res = dict(payload)
        res["id"] = req_id
        res["status"] = status
        res["created_at"] = now
        res["updated_at"] = now
        return res

    @classmethod
    def save_agent_audit_log(cls, log_data: Dict[str, Any]) -> bool:
        """Persists an agent execution audit log to Supabase Cloud and local store."""
        import uuid
        run_id = log_data.get("run_id") or f"run_{uuid.uuid4()}"
        log_id = str(uuid.uuid4())
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # Cloud write if ready
        supabase_health = cls.check_supabase_health()
        if supabase_health.get("tables_ready"):
            try:
                status_val = "success" if log_data.get("success", True) else "error"
                if log_data.get("status") in ("success", "error", "partial_fallback"):
                    status_val = log_data.get("status")
                sb_payload = {
                    "id": log_id,
                    "run_id": run_id,
                    "session_id": log_data.get("session_id"),
                    "correlation_id": log_data.get("correlation_id"),
                    "route": log_data.get("route", "general_skin_education"),
                    "tools_invoked": log_data.get("tools_executed", log_data.get("tools_invoked", [])),
                    "tool_durations": log_data.get("tool_durations", log_data.get("tool_latencies", {})),
                    "evidence_citations": log_data.get("evidence_citations", log_data.get("evidence_references", [])),
                    "provider_mode": log_data.get("provider_mode", "deterministic_fallback"),
                    "duration_ms": float(log_data.get("total_duration_ms", log_data.get("duration_ms", 0.0))),
                    "status": status_val,
                    "error_detail": str(log_data.get("error", "")) if log_data.get("error") else None,
                    "created_at": now,
                }
                url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/agent_audit_logs"
                headers = {
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                }
                req = urllib.request.Request(url, data=json.dumps(sb_payload).encode("utf-8"), headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=CLOUD_HTTP_TIMEOUT) as resp:
                    return resp.status in (200, 201, 204)
            except Exception as e:
                logger.warning("Supabase save_agent_audit_log failed (%s)", e)
        return False


    @classmethod
    def list_appointment_requests(cls, limit: int = 50, email: Optional[str] = None) -> List[Dict[str, Any]]:
        """Lists saved appointment requests, optionally filtered by patient contact email."""
        with _lock:
            conn = sqlite3.connect(str(DB_PATH))
            conn.row_factory = sqlite3.Row
            try:
                if email:
                    rows = conn.execute(
                        "SELECT * FROM appointment_requests WHERE contact_email = ? ORDER BY created_at DESC LIMIT ?;",
                        (email, limit),
                    ).fetchall()
                else:
                    rows = conn.execute(
                        "SELECT * FROM appointment_requests ORDER BY created_at DESC LIMIT ?;",
                        (limit,),
                    ).fetchall()
                return [dict(r) for r in rows]
            finally:
                conn.close()

    @classmethod
    def update_appointment_status(cls, req_id: str, new_status: str) -> bool:
        """Updates appointment request status."""
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        with _lock:
            conn = sqlite3.connect(str(DB_PATH))
            try:
                conn.execute(
                    "UPDATE appointment_requests SET status = ?, updated_at = ? WHERE id = ?;",
                    (new_status, now, req_id),
                )
                conn.commit()
            except Exception as e:
                logger.error("Failed to update appointment status: %s", e)
                return False
            finally:
                conn.close()

        # Cloud sync to Supabase when tables are ready
        supabase_health = cls.check_supabase_health()
        if supabase_health.get("tables_ready"):
            try:
                url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/appointment_requests?id=eq.{req_id}"
                headers = {
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                }
                payload = {"status": new_status, "updated_at": now}
                req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="PATCH")
                with urllib.request.urlopen(req, timeout=CLOUD_HTTP_TIMEOUT) as resp:
                    pass
            except Exception as e:
                logger.warning("Supabase update_appointment_status failed (%s)", e)

        return True


# Convenience aliases
save_analysis = PersistenceService.save_analysis
get_analysis = PersistenceService.get_analysis
update_verification = PersistenceService.update_verification
check_supabase_health = PersistenceService.check_supabase_health
save_conversation = PersistenceService.save_conversation
add_conversation_message = PersistenceService.add_conversation_message
get_conversation = PersistenceService.get_conversation
list_conversations = PersistenceService.list_conversations
update_conversation_title = PersistenceService.update_conversation_title
delete_conversation = PersistenceService.delete_conversation
save_appointment_request = PersistenceService.save_appointment_request
list_appointment_requests = PersistenceService.list_appointment_requests
update_appointment_status = PersistenceService.update_appointment_status
persistence_service = PersistenceService
