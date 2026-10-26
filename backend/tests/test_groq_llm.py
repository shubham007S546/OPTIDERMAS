"""Unit and Integration Tests for Groq LLM Provider & Fallback Synthesis."""
import unittest
from unittest.mock import MagicMock, patch
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.config import settings
from app.agents.optiderma_agent import (
    OptiDermaAgentWorkflow,
    GenerateAnswerInput,
)


class TestGroqLLMProvider(unittest.TestCase):
    def setUp(self):
        self.workflow = OptiDermaAgentWorkflow()
        self.sample_passages = [
            {
                "id": "aad_mel_01",
                "title": "AAD Guidelines for Care of Primary Cutaneous Melanoma",
                "source": "American Academy of Dermatology (2019)",
                "content": "Dermoscopy improves diagnostic accuracy for melanoma compared with unaided visual inspection. Key criteria include asymmetric pigmentation and atypical network.",
                "metadata": {"treatment_guidelines": "Complete surgical excision with clinical margins."}
            }
        ]

    def test_missing_groq_key_uses_deterministic_literature_fallback(self):
        """When GROQ_API_KEY is unset or empty, agent uses literature_direct synthesis."""
        with patch.object(settings, "GROQ_API_KEY", ""):
            inp = GenerateAnswerInput(
                query="What are melanoma dermoscopy features?",
                passages=self.sample_passages,
            )
            result = self.workflow._tool_generate_answer(inp)
            self.assertEqual(result["provider"], "literature_direct")
            self.assertIn("Clinical Evidence Summary", result["answer"])
            self.assertIn("American Academy of Dermatology", result["answer"])
            self.assertEqual(len(result["citations"]), 1)
            self.assertEqual(result["citations"][0]["citation_id"], "CIT-1")

    def test_groq_timeout_falls_back_gracefully(self):
        """When Groq request times out, agent safely falls back to literature_direct."""
        with patch.object(settings, "GROQ_API_KEY", "dummy_key"):
            with patch("groq.Groq") as mock_groq_class:
                mock_client = MagicMock()
                mock_client.chat.completions.create.side_effect = TimeoutError("Groq request timed out after 10.0s")
                mock_groq_class.return_value = mock_client

                inp = GenerateAnswerInput(
                    query="What are melanoma dermoscopy features?",
                    passages=self.sample_passages,
                )
                result = self.workflow._tool_generate_answer(inp)
                self.assertEqual(result["provider"], "literature_direct")
                self.assertIn("Clinical Evidence Summary", result["answer"])

    def test_groq_rate_limit_falls_back_gracefully(self):
        """When Groq returns rate limit (HTTP 429), agent safely falls back to literature_direct."""
        with patch.object(settings, "GROQ_API_KEY", "dummy_key"):
            with patch("groq.Groq") as mock_groq_class:
                mock_client = MagicMock()
                mock_client.chat.completions.create.side_effect = Exception("Rate limit exceeded: 429 Too Many Requests")
                mock_groq_class.return_value = mock_client

                inp = GenerateAnswerInput(
                    query="What are melanoma dermoscopy features?",
                    passages=self.sample_passages,
                )
                result = self.workflow._tool_generate_answer(inp)
                self.assertEqual(result["provider"], "literature_direct")

    def test_groq_malformed_response_falls_back(self):
        """When Groq returns choices with empty content and no reasoning, agent falls back."""
        with patch.object(settings, "GROQ_API_KEY", "dummy_key"):
            with patch("groq.Groq") as mock_groq_class:
                mock_client = MagicMock()
                mock_choice = MagicMock()
                mock_choice.message.content = ""
                mock_choice.message.reasoning = ""
                mock_resp = MagicMock()
                mock_resp.choices = [mock_choice]
                mock_client.chat.completions.create.return_value = mock_resp
                mock_groq_class.return_value = mock_client

                inp = GenerateAnswerInput(
                    query="What are melanoma dermoscopy features?",
                    passages=self.sample_passages,
                )
                result = self.workflow._tool_generate_answer(inp)
                self.assertEqual(result["provider"], "literature_direct")

    def test_groq_successful_mocked_generation(self):
        """When Groq returns valid text, answer is preserved with citations and provider tag."""
        with patch.object(settings, "GROQ_API_KEY", "dummy_key"):
            with patch("groq.Groq") as mock_groq_class:
                mock_client = MagicMock()
                mock_choice = MagicMock()
                mock_choice.message.content = (
                    "According to [CIT-1], key dermoscopic features of melanoma include "
                    "asymmetric pigmentation and atypical network. Clinical examination is necessary."
                )
                mock_resp = MagicMock()
                mock_resp.choices = [mock_choice]
                mock_client.chat.completions.create.return_value = mock_resp
                mock_groq_class.return_value = mock_client

                inp = GenerateAnswerInput(
                    query="What are melanoma dermoscopy features?",
                    passages=self.sample_passages,
                )
                result = self.workflow._tool_generate_answer(inp)
                self.assertTrue(result["provider"].startswith("groq:"))
                self.assertIn("[CIT-1]", result["answer"])
                self.assertEqual(len(result["citations"]), 1)

    def test_empty_passages_returns_calibrated_uncertainty(self):
        """When no passages are retrieved, agent expresses calibrated uncertainty."""
        with patch.object(settings, "GROQ_API_KEY", ""):
            inp = GenerateAnswerInput(
                query="Can you diagnose liver cirrhosis?",
                passages=[],
            )
            result = self.workflow._tool_generate_answer(inp)
            self.assertEqual(result["provider"], "literature_direct")
            self.assertIn("does not contain adequate evidence", result["answer"])
            self.assertEqual(len(result["citations"]), 0)

    def test_live_groq_generation_if_key_present(self):
        """When GROQ_API_KEY is configured in backend/.env, test real live LLM generation."""
        if not settings.GROQ_API_KEY:
            self.skipTest("GROQ_API_KEY not configured in environment")

        inp = GenerateAnswerInput(
            query="What are the dermoscopic patterns of melanoma according to clinical guidelines?",
            passages=self.sample_passages,
        )
        result = self.workflow._tool_generate_answer(inp)
        self.assertTrue(result["provider"].startswith("groq:"))
        self.assertTrue(len(result["answer"]) > 20)
        self.assertEqual(len(result["citations"]), 1)
        self.assertEqual(result["citations"][0]["citation_id"], "CIT-1")


if __name__ == "__main__":
    unittest.main()
