"""Pydantic schemas for OptiDerma dermatology multimodal domain objects."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class UserSymptoms(BaseModel):
    query: str = Field(..., description="User query or transcript of symptoms")
    duration: Optional[str] = Field(None, description="Reported duration of symptoms")
    location: Optional[str] = Field(None, description="Body location of lesion or rash")
    severity: Optional[str] = Field(None, description="Self-reported severity (e.g. mild, moderate, severe)")
    associated_symptoms: List[str] = Field(default_factory=list, description="Other associated symptoms (e.g. itching, bleeding, pain)")
    triggers: List[str] = Field(default_factory=list, description="Potential aggravating factors or triggers")


class FindingItem(BaseModel):
    condition_name: str
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    category: str = Field("benign", description="e.g. benign, higher_concern, inflammatory")
    description: str


class SkinAnalysis(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    has_image: bool = True
    model_name: str = Field("Groq Llama Vision (Investigational)", description="Identifier of the vision engine used")
    findings: List[FindingItem] = Field(default_factory=list)
    top_prediction: str = "Unspecified Skin Presentation"
    top_confidence: float = 0.0
    detected_features: List[str] = Field(default_factory=list)
    is_dermatology_validated: bool = Field(False, description="Disclaims that model is NOT a validated diagnostic device")
    raw_analysis: Optional[str] = None


class RAGPassage(BaseModel):
    title: str
    source: str
    content: str
    relevance_score: float = 0.0
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SafetyAssessment(BaseModel):
    is_emergency: bool = False
    red_flags_detected: List[str] = Field(default_factory=list)
    urgency_level: str = Field("routine", description="routine, prompt, or emergency")
    override_guidance: Optional[str] = None
    requires_immediate_care: bool = False


class MedicalAssessment(BaseModel):
    differential_possibilities: List[str] = Field(default_factory=list)
    summary_explanation: str
    supporting_symptoms: List[str] = Field(default_factory=list)
    clarifying_questions: List[str] = Field(default_factory=list)
    general_guidance: str
    red_flags: List[str] = Field(default_factory=list)
    consultation_recommended: bool = True
    disclaimer: str = (
        "OptiDerma is an educational research decision-support tool, not a clinical diagnostic device. "
        "Always seek a professional evaluation by a qualified dermatologist for skin concerns."
    )


class ToolExecutionRecord(BaseModel):
    tool_name: str
    status: str = "success"  # "success" | "error" | "skipped"
    latency_ms: float = 0.0
    input_summary: Dict[str, Any] = Field(default_factory=dict)
    output_summary: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None


class AgentTrace(BaseModel):
    request_id: str
    selected_route: str
    tools_executed: List[ToolExecutionRecord] = Field(default_factory=list)
    retrieval_sources: List[str] = Field(default_factory=list)
    llm_provider: str = "none"
    total_duration_ms: float = 0.0
    final_status: str = "completed"


class AgentRequest(BaseModel):
    query: str
    image_base64: Optional[str] = None
    symptoms: Optional[UserSymptoms] = None
    analysis_id: Optional[str] = None
    conversation_id: Optional[str] = None


class AgentResponse(BaseModel):
    user_query: str
    safety: SafetyAssessment
    skin_analysis: Optional[SkinAnalysis] = None
    retrieved_evidence: List[RAGPassage] = Field(default_factory=list)
    assessment: MedicalAssessment
    audio_url: Optional[str] = None
    trace: Optional[AgentTrace] = None
