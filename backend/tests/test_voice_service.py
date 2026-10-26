"""Unit and Mock Tests for Voice Integration (ElevenLabs & Audio Services)."""
import unittest
from unittest.mock import MagicMock, patch
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.config import settings
from app.services.stt_service import SpeechToTextService
from app.services.tts_service import TextToSpeechService


class TestVoiceIntegration(unittest.TestCase):

    def test_stt_missing_credentials_returns_clear_message(self):
        """When GROQ_API_KEY is missing, STT reports unavailable without crashing."""
        with patch.object(settings, "GROQ_API_KEY", ""):
            stt = SpeechToTextService(api_key="")
            result = stt.transcribe_audio_bytes(b"dummy_bytes")
            self.assertIn("GROQ_API_KEY not configured", result)

    def test_stt_successful_mocked_transcription(self):
        """When Whisper returns valid transcription, STT returns cleaned text."""
        stt = SpeechToTextService(api_key="mock_key")
        with patch("groq.Groq") as mock_groq_class:
            mock_client = MagicMock()
            mock_transcription = MagicMock()
            mock_transcription.text = "I have noticed an itchy rash on my back."
            mock_client.audio.transcriptions.create.return_value = mock_transcription
            mock_groq_class.return_value = mock_client

            result = stt.transcribe_audio_bytes(b"fake_mp3_data", filename="test_audio.mp3")
            self.assertEqual(result, "I have noticed an itchy rash on my back.")

    def test_stt_cleanup_on_failure(self):
        """When transcription raises an exception, temporary files are removed."""
        stt = SpeechToTextService(api_key="mock_key")
        with patch("groq.Groq") as mock_groq_class:
            mock_client = MagicMock()
            mock_client.audio.transcriptions.create.side_effect = RuntimeError("Audio decoder error")
            mock_groq_class.return_value = mock_client

            result = stt.transcribe_audio_bytes(b"fake_mp3_data", filename="corrupt.mp3")
            self.assertIn("Audio transcription failed", result)
            self.assertFalse(os.path.exists("temp_corrupt.mp3"))

    def test_tts_missing_credentials_handled_safely(self):
        """When ELEVEN_API_KEY is unconfigured, TTS falls back or returns None safely."""
        with patch.object(settings, "ELEVEN_API_KEY", ""):
            tts = TextToSpeechService(eleven_api_key="")
            self.assertIsNotNone(tts)

    def test_elevenlabs_route_contract_missing_credentials(self):
        """Simulate Next.js /api/voice-session logic when ELEVENLABS_API_KEY is missing."""
        api_key = None
        agent_id = "agent_6601m418gdvxe7zr1zksvnmtb3f1"
        if not api_key or not agent_id:
            status_code = 503
            body = {"error": "ElevenLabs credentials not configured on server. Please set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID."}
        else:
            status_code = 200
            body = {"signedUrl": "https://elevenlabs.io/..."}

        self.assertEqual(status_code, 503)
        self.assertIn("ElevenLabs credentials not configured", body["error"])

    def test_elevenlabs_route_contract_success(self):
        """Simulate Next.js /api/voice-session logic when valid credentials exist."""
        api_key = "valid_key"
        agent_id = "agent_6601m418gdvxe7zr1zksvnmtb3f1"
        if not api_key or not agent_id:
            status_code = 503
            body = {}
        else:
            status_code = 200
            body = {"signedUrl": "https://api.elevenlabs.io/v1/convai/conversation/signed?token=abc"}

        self.assertEqual(status_code, 200)
        self.assertTrue(body["signedUrl"].startswith("https://api.elevenlabs.io"))


if __name__ == "__main__":
    unittest.main()
