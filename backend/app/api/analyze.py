"""Analysis endpoints for OptiDerma multimodal reasoning."""

from fastapi import APIRouter, Depends, HTTPException
from app.agents.optiderma_agent import OptiDermaAgent
from app.schemas.dermatology import AgentRequest, AgentResponse

router = APIRouter(tags=["Analysis"])


def get_agent() -> OptiDermaAgent:
    return OptiDermaAgent()


@router.post("/analyze", response_model=AgentResponse)
def analyze_symptoms_and_image(
    request: AgentRequest,
    agent: OptiDermaAgent = Depends(get_agent),
):
    """Primary multimodal analysis route combining query, optional skin image, RAG, and safety triage."""
    try:
        response = agent.process(request)
        return response
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Multimodal analysis failed: {exc}"
        ) from exc
