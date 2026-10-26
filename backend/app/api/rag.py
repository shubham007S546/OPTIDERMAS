"""RAG Search and Ingestion API endpoints."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, HTTPException, Query
from app.rag.dermatology_rag import dermatology_rag
from app.schemas.dermatology import RAGPassage

router = APIRouter(prefix="/rag", tags=["Knowledge RAG"])


@router.get("/search", response_model=List[RAGPassage])
def search_dermatology_knowledge(
    q: str = Query(..., description="Query terms to search knowledge base"),
    top_k: Optional[int] = Query(2, ge=1, le=10),
):
    """Retrieve grounded dermatology knowledge base references matching input terms."""
    return dermatology_rag.retrieve_evidence(q, top_k=top_k or 2)


@router.get("/documents")
def list_indexed_documents() -> List[Dict[str, Any]]:
    """Lists all indexed clinical practice guidelines and research papers."""
    return dermatology_rag.list_all_documents()


@router.post("/ingest")
def ingest_document(document: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Dynamically ingest a new clinical document into the search corpus."""
    try:
        doc_id = dermatology_rag.ingest_document(document)
        return {"status": "success", "document_id": doc_id, "message": "Document successfully indexed."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
