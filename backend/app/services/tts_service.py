"""Text-to-Speech (TTS) service supporting ElevenLabs and gTTS audio generation."""

import os
import tempfile
from typing import Optional
from app.config import settings
from app.utils.logger import logger


class TextToSpeechService:
    """Service wrapper for converting clinical text responses into spoken MP3 audio."""

    def __init__(self, eleven_api_key: Optional[str] = None):
        self.eleven_api_key = eleven_api_key or settings.ELEVEN_API_KEY

    def generate_speech_bytes(self, text: str) -> bytes:
        """Generates MP3 speech audio bytes using ElevenLabs if key configured, or gTTS fallback."""
        if self.eleven_api_key:
            try:
                from elevenlabs.client import ElevenLabs

                client = ElevenLabs(api_key=self.eleven_api_key)
                audio_stream = client.generate(
                    text=text,
                    voice="Aria",
                    output_format="mp3_22050_32",
                    model="eleven_turbo_v2",
                )
                if isinstance(audio_stream, bytes):
                    return audio_stream
                return b"".join(audio_stream)
            except Exception as exc:
                logger.warning(f"ElevenLabs TTS failed ({exc}), falling back to gTTS.")

        # Fallback to gTTS
        try:
            from gtts import gTTS

            tts = gTTS(text=text, lang="en", slow=False)
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                tmp_path = tmp.name
            tts.save(tmp_path)
            with open(tmp_path, "rb") as f:
                data = f.read()
            os.remove(tmp_path)
            return data
        except Exception as exc:
            logger.error(f"gTTS audio generation error: {exc}")
            return b""
