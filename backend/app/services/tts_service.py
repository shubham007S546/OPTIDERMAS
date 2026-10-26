"""Text-to-Speech (TTS) service supporting ElevenLabs and gTTS audio generation."""

import os
import re
import tempfile
from typing import Optional, Tuple
from app.config import settings
from app.utils.logger import logger


def clean_text_for_speech(text: str, max_words: int = 140) -> str:
    """Prepares raw clinical markdown text into natural, fluent spoken audio.
    
    Strips markdown formatting, headers, citations like [CIT-1], and code blocks
    while preserving medical substance and clear pauses.
    """
    if not text:
        return ""

    # Remove citations like [CIT-1], [CIT-12]
    cleaned = re.sub(r"\[CIT-[^\]]+\]", "", text)
    # Remove markdown links [label](url) -> label
    cleaned = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", cleaned)
    # Remove markdown headers (#, ##, ###, etc.)
    cleaned = re.sub(r"#+\s*", "", cleaned)
    # Remove markdown bold/italics
    cleaned = re.sub(r"[*_]{1,3}", "", cleaned)
    # Remove inline code or backticks
    cleaned = re.sub(r"`[^`]*`", "", cleaned)
    # Remove HTML tags
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    # Remove bullet symbols
    cleaned = re.sub(r"^\s*[-•]\s*", "", cleaned, flags=re.MULTILINE)
    # Replace newlines with punctuation pause
    cleaned = re.sub(r"\n+", ". ", cleaned)
    # Collapse multiple spaces
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # If text is extensive (e.g. 6-segment breakdown), summarize for pleasant listening length
    words = cleaned.split()
    if len(words) > max_words:
        cleaned = " ".join(words[:max_words]) + "... Please refer to your on-screen consultation dashboard for the complete differential breakdown, morphometrics, and citations."

    return cleaned


_tts_cache: dict[str, tuple[bytes, str]] = {}


class TextToSpeechService:
    """Service wrapper for converting clinical text responses into spoken MP3 audio."""

    def __init__(self, eleven_api_key: Optional[str] = None):
        self.eleven_api_key = eleven_api_key or settings.ELEVEN_API_KEY
        self.default_voice = "Aria"

    def generate_speech_bytes(self, text: str) -> bytes:
        """Generates MP3 speech audio bytes using ElevenLabs if key configured, or gTTS fallback."""
        audio_bytes, _ = self.synthesize(text)
        return audio_bytes

    def synthesize(self, text: str) -> Tuple[bytes, str]:
        """Synthesizes speech and returns tuple of (audio_bytes, provider_name)."""
        spoken_text = clean_text_for_speech(text)
        if not spoken_text:
            return b"", "none"

        cache_key = spoken_text[:200]
        if cache_key in _tts_cache:
            return _tts_cache[cache_key]

        # 1. Try ElevenLabs if API key configured
        if self.eleven_api_key:
            try:
                from elevenlabs.client import ElevenLabs

                client = ElevenLabs(api_key=self.eleven_api_key)
                
                # Modern ElevenLabs SDK v2.x text_to_speech.convert
                if hasattr(client, "text_to_speech") and hasattr(client.text_to_speech, "convert"):
                    stream = client.text_to_speech.convert(
                        voice_id="9BWtsMINqrJLrRacOk9x",  # Standard Aria voice ID
                        text=spoken_text,
                        model_id="eleven_turbo_v2",
                        output_format="mp3_22050_32",
                    )
                    audio_data = b"".join(chunk for chunk in stream if isinstance(chunk, (bytes, bytearray)))
                    if audio_data:
                        _tts_cache[cache_key] = (audio_data, "elevenlabs")
                        return audio_data, "elevenlabs"

                # Legacy ElevenLabs generate method
                if hasattr(client, "generate"):
                    audio_stream = client.generate(
                        text=spoken_text,
                        voice=self.default_voice,
                        output_format="mp3_22050_32",
                        model="eleven_turbo_v2",
                    )
                    if isinstance(audio_stream, bytes):
                        _tts_cache[cache_key] = (audio_stream, "elevenlabs")
                        return audio_stream, "elevenlabs"
                    audio_data = b"".join(audio_stream)
                    if audio_data:
                        _tts_cache[cache_key] = (audio_data, "elevenlabs")
                        return audio_data, "elevenlabs"
            except Exception as exc:
                logger.warning(f"ElevenLabs TTS failed ({exc}), falling back to gTTS.")

        # 2. Local Google Text-to-Speech (gTTS) fallback with socket timeout
        try:
            import socket
            orig_timeout = socket.getdefaulttimeout()
            socket.setdefaulttimeout(8.0)
            try:
                from gtts import gTTS

                tts = gTTS(text=spoken_text, lang="en", slow=False)
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                    tmp_path = tmp.name
                tts.save(tmp_path)
                with open(tmp_path, "rb") as f:
                    data = f.read()
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
                if data:
                    _tts_cache[cache_key] = (data, "gtts")
                    return data, "gtts"
            finally:
                socket.setdefaulttimeout(orig_timeout)
        except Exception as exc:
            logger.error(f"gTTS audio generation error: {exc}")

        # 3. Fallback dummy MP3 frame if network is offline (valid 1-second silence MP3 frame)
        silent_mp3_header = b"\xff\xfb\x90\x64\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00" * 40
        return silent_mp3_header, "offline_audio"

