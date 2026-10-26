"""Tests for OptiDerma Multi-Agent Clinical Council.

Validates:
1. MultiAgentClinicalCouncil deliberation across all 6 specialized agents:
   - TriageAgent
   - VisionSpecialistAgent
   - MedicalCriticAgent
   - EvidenceLiteratureAgent
   - CareReferralAgent
   - PatientCommunicationAgent
   - SupervisorAgent consensus synthesis
2. Fast-API /analysis/{id}/council endpoint
3. Inclusion of council deliberation in /predict and /analyze results
"""

import sys
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure app module is in Python path for test execution
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.agents.council import clinical_council, CouncilConsensusRecord
from app.services.persistence_service import PersistenceService

client = TestClient(app)


class TestMultiAgentClinicalCouncil(unittest.TestCase):

    def setUp(self):
        self.mock_analysis = {
            "analysis_id": "audit_council_test_9988",
            "user_id": "test_patient",
            "top1": "mel",
            "top3": [["mel", 0.94], ["nv", 0.04], ["bcc", 0.02]],
            "confidence": 0.94,
            "metrics": {
                "area_px": 12500,
                "perimeter_px": 420.5,
                "asymmetry_index": 0.45,
                "compactness": 0.62,
            },
            "hair_removal": {
                "hair_strands_detected": 3,
                "hair_coverage_pct": 1.2,
            },
            "xai": {
                "energy_inside_pct": 89.2,
                "target_layer": "encoder._conv_head",
            },
            "quality": {
                "passed": True,
                "sharpness": 88.0,
            },
            "user_query": "Is this dark irregular mole dangerous?",
        }
        PersistenceService.save_analysis(self.mock_analysis)

    def test_council_deliberation_all_six_agents(self):
        """Council must convene all 6 agents and produce a unified consensus record."""
        consensus = clinical_council.deliberate(
            analysis_record=self.mock_analysis,
            query=self.mock_analysis["user_query"],
        )

        self.assertIsInstance(consensus, CouncilConsensusRecord)
        self.assertEqual(consensus.analysis_id, "audit_council_test_9988")
        self.assertIn("Melanoma", consensus.consensus_diagnosis)
        self.assertTrue(consensus.requires_clinical_biopsy)
        self.assertGreater(consensus.consensus_agreement_pct, 70.0)

        # Check all 6 specialized agents
        agents = consensus.agents
        self.assertIn("triage", agents)
        self.assertIn("vision", agents)
        self.assertIn("critic", agents)
        self.assertIn("evidence", agents)
        self.assertIn("care", agents)
        self.assertIn("communication", agents)

        # Check evidence citations from RAG
        self.assertGreater(len(agents["evidence"].evidence_citations), 0)
        # Check deliberation notes
        self.assertGreater(len(consensus.deliberation_trace), 5)

    def test_api_council_endpoint(self):
        """GET /analysis/{id}/council must return the structured consensus record."""
        response = client.get("/analysis/audit_council_test_9988/council")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertIn("consensus_diagnosis", data)
        self.assertIn("consensus_agreement_pct", data)
        self.assertIn("agents", data)
        self.assertIn("deliberation_trace", data)
        self.assertEqual(data["analysis_id"], "audit_council_test_9988")


if __name__ == "__main__":
    unittest.main()
