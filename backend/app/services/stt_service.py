"""Speech-to-Text (STT) service supporting Groq Whisper and local Audio transcription."""

import os
from typing import Optional
from app.config import settings
from app.utils.logger import logger


class SpeechToTextService:
    """Service wrapper for converting audio byte streams into text transcripts."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.stt_model = "whisper-large-v3"

    def transcribe_audio_bytes(self, audio_bytes: bytes, filename: str = "input.mp3") -> str:
        if not self.api_key:
            logger.warning("GROQ_API_KEY missing for STT transcription.")
            return "Audio transcript unavailable: GROQ_API_KEY not configured."

        temp_path = f"temp_{filename}"
        try:
            from groq import Groq

            with open(temp_path, "wb") as f:
                f.write(audio_bytes)

            client = Groq(api_key=self.api_key)
            with open(temp_path, "rb") as audio_file:
                transcription = client.audio.transcriptions.create(
                    model=self.stt_model,
                    file=audio_file,
                    language="en",
                )
            return transcription.text
        except Exception as exc:
            logger.error(f"Error during audio transcription: {exc}")
            return f"Audio transcription failed: {exc}"
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
