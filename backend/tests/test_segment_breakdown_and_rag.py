"""Unit tests for Advanced 7-Class RAG and 6-Segment Clinical Breakdown."""
import unittest
from app.rag.dermatology_rag import dermatology_rag, DERMATOLOGY_EVIDENCE_REPOSITORY
from app.agents.optiderma_agent import (
    HAM10000_CLASS_METADATA,
    _build_segment_wise_clinical_breakdown,
    OptiDermaAgentWorkflow,
)


class TestSegmentBreakdownAndRAG(unittest.TestCase):
    def setUp(self):
        self.rag = dermatology_rag
        self.workflow = OptiDermaAgentWorkflow()

    def test_all_seven_classes_have_rich_clinical_metadata(self):
        """Verify all 7 HAM10000 classes have complete clinical metadata."""
        expected_classes = ["mel", "nv", "bcc", "akiec", "bkl", "df", "vasc"]
        for cls in expected_classes:
            self.assertIn(cls, HAM10000_CLASS_METADATA, f"Missing class {cls} in metadata")
            meta = HAM10000_CLASS_METADATA[cls]
            self.assertTrue(meta.get("name"))
            self.assertTrue(meta.get("category"))
            self.assertTrue(len(meta.get("cell_origin", "")) > 30)
            self.assertTrue(len(meta.get("dermoscopic_signs", "")) > 30)
            self.assertTrue(len(meta.get("guidelines", "")) > 30)

    def test_rag_retrieves_documents_for_all_seven_classes(self):
        """Verify RAG engine returns relevant evidence for all 7 lesion classes."""
        expected_classes = ["mel", "nv", "bcc", "akiec", "bkl", "df", "vasc"]
        for cls in expected_classes:
            passages = self.rag.retrieve_evidence(
                query=f"Please explain my active {cls} skin findings and clinical guidelines",
                condition_codes=[cls],
                top_k=2,
            )
            self.assertGreaterEqual(len(passages), 1, f"No passages retrieved for class {cls}")
            self.assertGreaterEqual(passages[0].relevance_score, 0.5, f"Low relevance for class {cls}")

    def test_segment_breakdown_contains_all_six_clinical_segments(self):
        """Verify the clinical breakdown builder produces all 6 exact segments."""
        mock_analysis = {
            "analysis_id": "OD-7B29F4A1-LIVE",
            "top3": [["bcc", 0.912], ["mel", 0.054], ["nv", 0.021]],
            "risk": {"level": "High", "recommendation": "Urgent dermatological excision required."},
            "malignant_prob": 0.966,
            "metrics": {
                "area_px": 14250,
                "area_mm2": 15.8,
                "asymmetry_index": 0.42,
                "compactness": 1.18,
                "coverage_pct": 14.5,
            },
            "hair_removal": {
                "hair_detected": True,
                "detected_strands": 4,
                "hair_pixel_count": 860,
                "psnr_diff": 48.5,
            },
            "verification": {"passed": True},
        }

        mock_passages = [
            {
                "title": "Guidelines of Care for Basal Cell Carcinoma",
                "source": "British Journal of Dermatology",
                "content": "Basal cell carcinoma is the most common cutaneous malignancy.",
                "metadata": {
                    "treatment_guidelines": "Complete surgical excision with 4-5 mm margins or Mohs micrographic surgery."
                },
            }
        ]

        mock_citations = [
            {"citation_id": "CIT-1", "title": "BCC Guidelines", "source": "BJD"},
            {"citation_id": "CIT-2", "title": "IDS Dermoscopy", "source": "JAAD"},
        ]

        breakdown = _build_segment_wise_clinical_breakdown(mock_analysis, mock_passages, mock_citations)

        # Assert all 6 segments are present
        self.assertIn("### Segment 1: Clinical Greeting & Active Finding Summary", breakdown)
        self.assertIn("### Segment 2: Disease Nature, Histopathology & Pathogenesis", breakdown)
        self.assertIn("### Segment 3: Morphometric & Algorithmic Feature Correlation", breakdown)
        self.assertIn("### Segment 4: Differential Diagnosis Breakdown (7-Class HAM10000 Spectrum)", breakdown)
        self.assertIn("### Segment 5: Evidence-Based Clinical Management & Practice Guidelines", breakdown)
        self.assertIn("### Segment 6: Statutory Research Disclaimer & Clinical Action Plan", breakdown)

        # Assert key patient-specific clinical data is woven in
        self.assertIn("Basal Cell Carcinoma", breakdown)
        self.assertIn("91.2%", breakdown)
        self.assertIn("High Risk", breakdown)
        self.assertIn("14,250 pixels", breakdown)
        self.assertIn("4 occluding hair strands", breakdown)
        self.assertIn("[CIT-1]", breakdown)
        self.assertIn("[CIT-2]", breakdown)

    def test_run_turn_auto_executes_segment_breakdown_with_analysis(self):
        """Verify run_turn outputs the segment breakdown when an active analysis is present."""
        mock_analysis = {
            "analysis_id": "OD-TEST-AUTO-BREAKDOWN",
            "top3": [["mel", 0.884], ["nv", 0.081], ["bkl", 0.022]],
            "risk": {"level": "High", "recommendation": "Urgent narrow-margin biopsy indicated."},
            "malignant_prob": 0.892,
            "metrics": {"area_px": 9400, "area_mm2": 10.4, "asymmetry_index": 0.55, "compactness": 1.34, "coverage_pct": 9.8},
            "hair_removal": {"hair_detected": False, "detected_strands": 0},
            "verification": {"passed": True},
        }

        # Save to persistence
        from app.services.persistence_service import PersistenceService
        PersistenceService.save_analysis(mock_analysis)

        # Run turn
        turn = self.workflow.run_turn(
            query="Please explain my active skin lesion analysis findings in complete segment-wise clinical detail.",
            analysis_id="OD-TEST-AUTO-BREAKDOWN",
        )

        answer = turn["answer"]
        self.assertTrue("Clinical Greeting" in answer)
        self.assertTrue("Disease Nature" in answer)
        self.assertTrue("Morphometric" in answer)
        self.assertTrue("Differential Diagnosis" in answer)
        self.assertTrue("Clinical Management" in answer)
        self.assertTrue("Disclaimer" in answer or "Statutory Research" in answer)
        self.assertIn("Melanoma", answer)


if __name__ == "__main__":
    unittest.main()
