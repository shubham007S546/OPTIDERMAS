"""RAG Search API endpoints."""

from typing import List, Optional
from fastapi import APIRouter, Query
from app.rag.dermatology_rag import DermatologyRAGService
from app.schemas.dermatology import RAGPassage

router = APIRouter(prefix="/rag", tags=["Knowledge RAG"])


@router.get("/search", response_model=List[RAGPassage])
def search_dermatology_knowledge(
    q: str = Query(..., description="Query terms to search knowledge base"),
    top_k: Optional[int] = Query(2, ge=1, le=5),
):
    """Retrieve grounded dermatology knowledge base references matching input terms."""
    rag = DermatologyRAGService()
    return rag.retrieve_evidence(q, top_k=top_k)
