"""Pytest session isolation so tests never pollute live user SQLite history."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app.services.persistence_service as ps

_TEST_DB_DIR = Path(tempfile.mkdtemp(prefix="optiderma_pytest_"))
_TEST_DB_PATH = _TEST_DB_DIR / "optiderma_test_persistence.db"

# Redirect SQLite persistence to a clean per-session temp file before tests run
ps.DB_PATH = _TEST_DB_PATH
ps._in_memory_cache.clear()
ps._init_local_db()


@pytest.fixture(scope="session", autouse=True)
def _isolate_test_persistence_db():
    """Ensures all pytest modules share an isolated temp SQLite database."""
    yield
    ps._in_memory_cache.clear()
    for suffix in ("", "-shm", "-wal"):
        p = Path(f"{_TEST_DB_PATH}{suffix}")
        if p.exists():
            try:
                os.remove(p)
            except OSError:
                pass
