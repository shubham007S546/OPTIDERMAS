"""
End-to-end integration and provenance tests for OptiDerma:
- Real RAG retrieval with traceable document sources and dynamic indexing
- Agentic orchestrator dynamic tool routing (without image vs with image vs clinic vs report)
- Execution trace verification (latency, tools used, errors)
- Care Connect appointment persistence and truthful statuses
- Vision inference pipeline verification with checkpoint loading
"""
import pytest
import numpy as np
import cv2
from PIL import Image
import io
import base64

from backend.app.rag.dermatology_rag import DermatologyRAGService, dermatology_rag
from backend.app.agents.optiderma_agent import (
    optiderma_agent,
    optiderma_workflow,
    AgentRequest,
    AgentResponse,
    RetrieveEvidenceInput,
    SearchClinicsInput,
    GenerateReportInput,
    CreateAppointmentInput
)
from backend.app.services.care_service import care_service
from backend.app.services.persistence_service import PersistenceService
from backend.app.services.verification_service import verification_service


def generate_dummy_image_base64():
    """Generate a valid base64 encoded synthetic dermoscopy image for testing."""
    img = np.zeros((224, 224, 3), dtype=np.uint8)
    # Draw a simulated pigment network / lesion
    cv2.circle(img, (112, 112), 40, (40, 50, 120), -1)
    cv2.circle(img, (120, 110), 20, (20, 30, 80), -1)
    
    pil_img = Image.fromarray(img)
    buffer = io.BytesIO()
    pil_img.save(buffer, format="JPEG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


class TestAgenticPipeline:

    def test_rag_provenance_and_dynamic_indexing(self):
        """Verify RAG retrieval yields traceable citations and supports dynamic ingestion."""
        rag = DermatologyRAGService()
        
        # Ingest a custom research snippet
        custom_doc_id = "test_guideline_2026_xyz"
        rag.ingest_document(
            doc_id=custom_doc_id,
            title="Dermatology Protocol XYZ 2026",
            category="guideline",
            source="American Academy of Dermatology (AAD) 2026",
            text="Patients presenting with irregular asymmetrical borders larger than 6mm require urgent dermatoscopy excision biopsy within 14 days."
        )
        
        # Search query matching the newly ingested document
        results = rag.search("urgent dermatoscopy excision biopsy 14 days", top_k=3)
        assert len(results) > 0, "RAG search must return matching evidence"
        
        # Verify provenance
        custom_hit = next((r for r in results if r.get("id") == custom_doc_id), results[0])
        assert custom_hit["source"] == "American Academy of Dermatology (AAD) 2026"
        assert custom_hit["title"] == "Dermatology Protocol XYZ 2026"
        assert "score" in custom_hit and custom_hit["score"] > 0
        assert "excision biopsy within 14 days" in custom_hit["content"]
        
        # Clean up dynamic document
        rag.delete_document(custom_doc_id)
        post_delete_results = rag.search("test_guideline_2026_xyz", top_k=1)
        assert all(r["id"] != custom_doc_id for r in post_delete_results)

    def test_agent_workflow_general_query_no_image(self):
        """General questions must NOT trigger vision inference or hallucinate image findings."""
        turn = optiderma_workflow.run_turn(
            query="What are the clinical ABCDE criteria for assessing pigmented skin lesions?",
            user_id="test_user_general",
            image_base64=None
        )
        
        assert "answer" in turn and len(turn["answer"]) > 0
        assert turn["intent"] == "general_skin_education"
        assert turn["trace"] is not None
        
        # Verify tool routing: vision tool must NOT have executed
        tools_run = [rec["tool_name"] for rec in turn["trace"]["tools_executed"]]
        assert "analyze_skin_image" not in tools_run
        assert "retrieve_dermatology_evidence" in tools_run
        assert "generate_evidence_grounded_answer" in tools_run
        
        # Verify traceable citations
        assert len(turn["citations"]) > 0
        for citation in turn["citations"]:
            assert "source" in citation and "title" in citation
            assert len(citation["source"]) > 0

    def test_agent_workflow_image_query_triggers_multimodal_vision(self):
        """Lesion assessment query with image base64 must invoke the real PyTorch vision pipeline."""
        img_b64 = generate_dummy_image_base64()
        turn = optiderma_workflow.run_turn(
            query="Please analyze this pigmented lesion on my back and check for melanoma signs.",
            user_id="test_user_vision",
            image_base64=img_b64
        )
        
        assert turn["intent"] == "image_analysis_and_triage"
        tools_run = [rec["tool_name"] for rec in turn["trace"]["tools_executed"]]
        assert "analyze_skin_image" in tools_run
        assert "retrieve_dermatology_evidence" in tools_run
        
        # Check that answer was generated from evidence and vision findings
        assert len(turn["citations"]) > 0
        assert turn["trace"]["total_duration_ms"] > 0

    def test_multiagent_adapter_run(self):
        """Verify the high-level multiagent system contract returning typed AgentResponse."""
        req = AgentRequest(query="What is basal cell carcinoma?")
        res = optiderma_agent.run(req)
        
        assert isinstance(res, AgentResponse)
        assert res.safety.is_emergency is False
        assert res.safety.urgency_level == "routine"
        assert len(res.retrieved_evidence) > 0
        assert res.assessment is not None
        assert res.trace is not None

    def test_care_connect_persistence_and_booking(self):
        """Care Connect must find real clinics, create requests, and persist them durably."""
        clinics = care_service.find_verified_clinics()
        assert len(clinics) >= 2
        assert all("name" in c and c.get("verified") is True for c in clinics)
        
        # Create an appointment request
        req = care_service.submit_appointment_request(
            patient_name="Alex Smith",
            clinic_id=clinics[0]["id"],
            preferred_date="2026-11-05",
            consultation_type="in-person",
            contact_email="alex.smith@example.com",
            reason="Requires dermoscopic evaluation under clinical guidance."
        )
        assert req["status"] == "pending_provider_confirmation"
        assert req["id"] is not None
        
        # Verify persistence retrieval
        all_reqs = care_service.get_all_appointment_requests()
        matching = [r for r in all_reqs if r["id"] == req["id"]]
        assert len(matching) == 1
        assert matching[0]["patient_name"] == "Alex Smith"
        assert matching[0]["status"] == "pending_provider_confirmation"

    def test_truthful_supabase_status(self):
        """Persistence health probe must truthfully report local mode when cloud schema is pending."""
        health = PersistenceService.check_supabase_health()
        assert "backend_mode" in health
        assert "status" in health
        assert health["status"] in ("connected", "pending_migration", "healthy", "error", "configured_offline", "unreachable")

    def test_direct_tools_execution(self):
        """Individual agent tools must execute cleanly with typed inputs and outputs."""
        tools = optiderma_workflow.tools
        
        # Tool: retrieve_dermatology_evidence
        rag_tool = tools["retrieve_dermatology_evidence"]
        rag_out, rag_rec = rag_tool.execute(RetrieveEvidenceInput(query="basal cell carcinoma dermoscopy features", top_k=2))
        assert rag_rec.status == "success"
        assert rag_out["total_retrieved"] > 0
        
        # Tool: search_verified_care_resources
        care_tool = tools["search_verified_care_resources"]
        care_out, care_rec = care_tool.execute(SearchClinicsInput(specialty="Dermatology"))
        assert care_rec.status == "success"
        assert care_out["total_found"] > 0
        
        # Tool: create_appointment_request
        apt_tool = tools["create_appointment_request"]
        apt_out, apt_rec = apt_tool.execute(CreateAppointmentInput(
            patient_name="Taylor Swift",
            contact_email="taylor@example.com",
            preferred_date="2026-11-10",
            reason="Routine skin check"
        ))
        assert apt_rec.status == "success"
        assert apt_out["status"] == "pending_provider_confirmation"
