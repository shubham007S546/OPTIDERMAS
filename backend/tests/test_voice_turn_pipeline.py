"""Tests for Milestone 1: Unified Spoken Voice-Turn Pipeline.

Validates end-to-end integration of:
- Speech-to-Text (Groq Whisper)
- Multi-modal vision analysis
- 8-node Agentic RAG clinical reasoning
- Text-to-Speech (ElevenLabs / gTTS)
- FastAPI /api/v1/agent/voice-turn endpoint (multipart, json, binary audio formats)
"""

from __future__ import annotations

import base64
import io
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.persistence_service import PersistenceService
from app.services.tts_service import clean_text_for_speech
from app.services.voice_turn_service import VoiceTurnService, voice_turn_service


class TestVoiceTurnPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_clean_text_for_speech_strips_markdown_and_citations(self):
        """Verifies clean_text_for_speech strips markdown artifacts, hashes, and [CIT-X]."""
        raw = "### Clinical Findings\nBased on AAD guidelines [CIT-1, CIT-2], the lesion is **benign**.\n- Check borders\n- [Visit Clinic](https://example.com)"
        cleaned = clean_text_for_speech(raw)

        self.assertNotIn("###", cleaned)
        self.assertNotIn("[CIT-1", cleaned)
        self.assertNotIn("**", cleaned)
        self.assertNotIn("https://", cleaned)
        self.assertIn("Clinical Findings", cleaned)
        self.assertIn("benign", cleaned)
        self.assertIn("Visit Clinic", cleaned)

    def test_voice_turn_with_text_only_synthesizes_audio(self):
        """Voice turn without audio bytes uses text query and synthesizes spoken response."""
        res = voice_turn_service.process_voice_turn(
            query_text="What is eczema and how is it treated?",
            output_audio=True,
        )

        self.assertTrue(res["ok"])
        self.assertEqual(res["transcription_status"], "not_provided")
        self.assertIn("eczema", res["answer"].lower())
        self.assertTrue(len(res["spoken_text"]) > 0)
        self.assertTrue(len(res["audio_base64"]) > 0)
        self.assertIn(res["tts_provider"], ["gtts", "elevenlabs"])

        # Decode base64 to ensure genuine MP3 data
        audio_bytes = base64.b64decode(res["audio_base64"])
        self.assertTrue(len(audio_bytes) > 500)

    def test_voice_turn_with_mocked_stt_transcription(self):
        """When audio bytes are provided, STT is executed and transcribed text becomes query."""
        mock_stt = MagicMock()
        mock_stt.transcribe_audio_bytes.return_value = "What are the common signs of melanoma?"

        service = VoiceTurnService(stt_service=mock_stt)
        res = service.process_voice_turn(
            audio_bytes=b"fake_mp3_data",
            audio_filename="recording.mp3",
            output_audio=True,
        )

        mock_stt.transcribe_audio_bytes.assert_called_once()
        self.assertTrue(res["ok"])
        self.assertEqual(res["transcript"], "What are the common signs of melanoma?")
        self.assertEqual(res["transcription_status"], "success")
        self.assertIn("melanoma", res["answer"].lower())
        self.assertTrue(len(res["audio_base64"]) > 0)

    def test_voice_turn_grounded_in_active_analysis(self):
        """When analysis_id is provided, voice turn grounds in the active 6-segment clinical breakdown."""
        test_aid = "audit_voice_analysis_12345"
        PersistenceService.save_analysis(
            record={
                "analysis_id": test_aid,
                "top1": "bcc",
                "top3": [["bcc", 0.94], ["nv", 0.04], ["mel", 0.02]],
                "confidence": 0.94,
                "urgency": "medium",
                "condition_name": "Basal Cell Carcinoma",
                "metrics": {"area_mm2": 18.5, "asymmetry_index": 0.35},
                "dullrazor": {"hair_strands_detected": 2},
            }
        )

        res = voice_turn_service.process_voice_turn(
            query_text="Can you explain this diagnosis?",
            analysis_id=test_aid,
            output_audio=True,
        )

        self.assertTrue(res["ok"])
        self.assertEqual(res["analysis_id"], test_aid)
        self.assertTrue("basal cell carcinoma" in res["answer"].lower() or "bcc" in res["answer"].lower())
        self.assertTrue("Segment 1" in res["answer"] or "Clinical Greeting" in res["answer"])
        self.assertTrue(len(res["spoken_text"]) > 0)
        self.assertTrue(len(res["audio_base64"]) > 0)

    def test_api_v1_agent_voice_turn_multipart(self):
        """HTTP POST /api/v1/agent/voice-turn with multipart form parameters."""
        response = self.client.post(
            "/api/v1/agent/voice-turn",
            data={
                "query": "Is psoriasis contagious?",
                "output_audio": "true",
            },
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["ok"])
        self.assertIn("psoriasis", data["answer"].lower())
        self.assertTrue(len(data["audio_base64"]) > 0)
        self.assertEqual(data["audio_format"], "audio/mpeg")

    def test_api_v1_agent_voice_turn_binary_audio_format(self):
        """HTTP POST /api/v1/agent/voice-turn?response_format=audio returns audio/mpeg directly."""
        response = self.client.post(
            "/api/v1/agent/voice-turn?response_format=audio",
            data={
                "query": "What causes dandruff?",
                "output_audio": "true",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "audio/mpeg")
        self.assertTrue(len(response.content) > 1000)
        self.assertIn("X-Conversation-ID", response.headers)

    def test_api_v1_agent_voice_turn_json_endpoint(self):
        """HTTP POST /api/v1/agent/voice-turn/json with JSON body."""
        payload = {
            "query": "How should I protect my skin from sun damage?",
            "output_audio": True,
        }
        response = self.client.post("/api/v1/agent/voice-turn/json", json=payload)

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["ok"])
        self.assertIn("sun", data["answer"].lower())
        self.assertTrue(len(data["audio_base64"]) > 0)


if __name__ == "__main__":
    unittest.main()
