"""Phase 1 Backend Integration & Unit Tests."""

import sys
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure app module is in Python path for test execution
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.safety.safety_checker import SafetyChecker
from app.rag.dermatology_rag import DermatologyRAGService

client = TestClient(app)


class TestOptiDermaBackend(unittest.TestCase):

    def test_health_endpoint(self):
        response = client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["ok"])
        self.assertIn("OptiDerma", data["service"])

    def test_root_endpoint(self):
        response = client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "online")

    def test_safety_checker_routine(self):
        checker = SafetyChecker()
        eval_res = checker.evaluate("I have a dry patch on my arm that itches slightly.")
        self.assertFalse(eval_res.is_emergency)
        self.assertEqual(eval_res.urgency_level, "routine")

    def test_safety_checker_emergency(self):
        checker = SafetyChecker()
        eval_res = checker.evaluate("I have a rapidly spreading rash and severe shortness of breath and swollen throat.")
        self.assertTrue(eval_res.is_emergency)
        self.assertEqual(eval_res.urgency_level, "emergency")
        self.assertTrue(eval_res.requires_immediate_care)
        self.assertIsNotNone(eval_res.override_guidance)

    def test_dermatology_rag(self):
        rag = DermatologyRAGService()
        results = rag.retrieve_evidence("actinic keratosis scaly spot", top_k=1)
        self.assertGreaterEqual(len(results), 1)
        self.assertIn("Actinic Keratosis", results[0].title)

    def test_analyze_api_routine(self):
        payload = {
            "query": "I have an itchy red patch on my elbow for 3 days.",
            "symptoms": {
                "query": "I have an itchy red patch on my elbow for 3 days.",
                "duration": "3 days",
                "location": "elbow",
                "severity": "mild",
                "associated_symptoms": ["itching", "redness"],
                "triggers": ["new laundry detergent"],
            }
        }
        response = client.post("/api/v1/analyze", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data["safety"]["is_emergency"])
        self.assertGreater(len(data["assessment"]["differential_possibilities"]), 0)
        self.assertIn("disclaimer", data["assessment"])

    def test_analyze_api_emergency(self):
        payload = {
            "query": "I have a rapidly spreading rash, high fever, and severe difficulty breathing.",
        }
        response = client.post("/api/v1/analyze", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["safety"]["is_emergency"])
        self.assertIn("URGENT MEDICAL WARNING", data["assessment"]["summary_explanation"])


if __name__ == "__main__":
    unittest.main()
