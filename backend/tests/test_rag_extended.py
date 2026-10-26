"""Extended Unit Tests for Dermatology RAG Corpus, Ingestion, Deletion & Edge Cases."""
import unittest
import copy
from app.rag.dermatology_rag import DermatologyRAGService, DERMATOLOGY_EVIDENCE_REPOSITORY


class TestDermatologyRAGExtended(unittest.TestCase):
    def setUp(self):
        self.rag = DermatologyRAGService()

    def test_all_repository_documents_have_traceable_provenance(self):
        """Verify that every indexed guideline has complete traceable metadata."""
        for doc in DERMATOLOGY_EVIDENCE_REPOSITORY:
            self.assertTrue(doc.get("id"), "Missing document ID")
            self.assertTrue(doc.get("title"), f"Missing title in {doc.get('id')}")
            self.assertTrue(doc.get("source"), f"Missing source publisher in {doc.get('id')}")
            self.assertTrue(doc.get("url"), f"Missing canonical URL in {doc.get('id')}")
            self.assertTrue(doc.get("publication_year"), f"Missing publication year in {doc.get('id')}")
            self.assertTrue(doc.get("evidence_level"), f"Missing evidence level in {doc.get('id')}")
            self.assertTrue(len(doc.get("content", "")) > 50, f"Content too brief in {doc.get('id')}")

    def test_empty_query_returns_empty_or_routine_results(self):
        """Verify empty query string does not crash and returns empty or gated results."""
        results = self.rag.retrieve_evidence("", top_k=3)
        self.assertIsInstance(results, list)

    def test_unsupported_out_of_domain_query_yields_empty_results(self):
        """Unsupported queries like quantum computing or liver enzymes should yield zero results."""
        results = self.rag.retrieve_evidence("quantum superposition entanglement Hamiltonian eigenvalue", top_k=3)
        self.assertEqual(len(results), 0, "Out-of-domain query should return 0 results due to relevance threshold")

    def test_dynamic_ingest_and_deletion(self):
        """Ingest a disposable guideline, retrieve it, delete it, and confirm it is no longer retrievable."""
        test_doc_id = "test-custom-psoriasis-2026"
        custom_doc = {
            "id": test_doc_id,
            "title": "Experimental Topical Calcipotriene Formulations",
            "source": "Investigational Dermatology Archive (2026)",
            "url": "https://example.org/test-guideline",
            "publication_year": 2026,
            "evidence_level": "Level II-2",
            "category": "psoriasis_experimental",
            "content": "Calcipotriene plus betamethasone dipropionate demonstrates significant PASI-75 reduction in chronic plaque psoriasis.",
            "treatment_guidelines": "Apply once daily to affected plaques for up to 4 weeks.",
            "keywords": ["calcipotriene", "plaque", "psoriasis", "betamethasone"],
        }

        # 1. Ingest document
        ingest_ok = self.rag.ingest_document(custom_doc)
        self.assertTrue(ingest_ok)

        # 2. Retrieve document
        results = self.rag.retrieve_evidence("calcipotriene plaque psoriasis", top_k=3)
        found_ids = [p.metadata.get("id") for p in results if p.metadata]
        self.assertIn(test_doc_id, found_ids)

        # 3. Delete document
        delete_ok = self.rag.delete_document(test_doc_id)
        self.assertTrue(delete_ok)

        # 4. Verify it cannot be retrieved
        results_post = self.rag.retrieve_evidence("calcipotriene plaque psoriasis", top_k=3)
        found_ids_post = [p.metadata.get("id") for p in results_post if p.metadata]
        self.assertNotIn(test_doc_id, found_ids_post)

    def test_malformed_document_ingestion_handled_safely(self):
        """Ingesting documents with missing content raises ValueError to prevent corrupting repository."""
        malformed = {"id": "invalid-no-content"}
        with self.assertRaises(ValueError):
            self.rag.ingest_document(malformed)


if __name__ == "__main__":
    unittest.main()
