"""OptiDerma Unified Spoken Voice-Turn Service.

Directly bridges Speech-to-Text (Groq Whisper), Multimodal Skin Analysis,
the 8-node Agentic RAG Clinical Orchestrator, and Text-to-Speech (ElevenLabs / gTTS)
into a cohesive end-to-end voice consultation pipeline.
"""

from __future__ import annotations

import base64
import os
import uuid
from typing import Any, Dict, Optional, Tuple

from app.services.inference_service import run_prediction
from app.services.persistence_service import PersistenceService
from app.services.stt_service import SpeechToTextService
from app.services.tts_service import TextToSpeechService, clean_text_for_speech
from app.utils.logger import logger


class VoiceTurnService:
    """End-to-end orchestrator for voice-driven dermatology consultation turns."""

    def __init__(
        self,
        stt_service: Optional[SpeechToTextService] = None,
        tts_service: Optional[TextToSpeechService] = None,
    ):
        self.stt = stt_service or SpeechToTextService()
        self.tts = tts_service or TextToSpeechService()

    def process_voice_turn(
        self,
        audio_bytes: Optional[bytes] = None,
        audio_filename: Optional[str] = "input.mp3",
        query_text: Optional[str] = None,
        image_bytes: Optional[bytes] = None,
        analysis_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        user_id: Optional[str] = "patient_user",
        output_audio: bool = True,
    ) -> Dict[str, Any]:
        """Processes an incoming spoken consultation turn.

        Args:
            audio_bytes: Raw recorded user audio bytes from browser or client.
            audio_filename: Filename with extension (e.g., input.mp3, recording.webm).
            query_text: Optional explicit text fallback or query string.
            image_bytes: Optional raw image bytes for simultaneous lesion analysis.
            analysis_id: Optional UUID of prior persisted analysis to ground response.
            conversation_id: Optional conversation session UUID.
            user_id: Patient or provider user identifier.
            output_audio: Whether to synthesize MP3 audio response (default: True).

        Returns:
            Structured dictionary with transcript, clinical answer, spoken audio base64,
            citations, trace, and conversation identifiers.
        """
        transcript = ""
        transcription_status = "not_provided"

        # 1. Speech-to-Text (STT) via Groq Whisper
        if audio_bytes and len(audio_bytes) > 0:
            fname = audio_filename or "input.mp3"
            logger.info(f"Transcribing {len(audio_bytes)} audio bytes (filename: {fname}).")
            raw_transcript = self.stt.transcribe_audio_bytes(audio_bytes, filename=fname)
            
            if raw_transcript.startswith("Audio transcript unavailable") or raw_transcript.startswith("Audio transcription failed"):
                logger.warning(f"STT warning: {raw_transcript}")
                transcription_status = "failed"
                # Keep error message in transcript for diagnostics, but do not use as medical query
                transcript = raw_transcript
            else:
                transcript = raw_transcript.strip()
                transcription_status = "success"

        # 2. Determine effective user query
        effective_query = ""
        if transcription_status == "success" and transcript:
            effective_query = transcript
        elif query_text and query_text.strip():
            effective_query = query_text.strip()
        elif image_bytes and len(image_bytes) > 0:
            effective_query = "Please assess this uploaded skin lesion photograph for dermatological findings."
        else:
            effective_query = "Hello, please provide an overview of your dermatology assessment capabilities."

        # 3. Optional Multimodal Vision Processing
        active_analysis_id = analysis_id
        new_analysis_record = None
        image_b64 = None

        if image_bytes and len(image_bytes) > 0:
            try:
                logger.info(f"Executing multimodal vision inference on {len(image_bytes)} image bytes.")
                new_analysis_record = run_prediction(
                    image_bytes=image_bytes,
                    user_query=effective_query,
                )
                if new_analysis_record and "analysis_id" in new_analysis_record:
                    active_analysis_id = new_analysis_record["analysis_id"]
                    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
                    logger.info(f"Associated new analysis record: {active_analysis_id}")
            except Exception as exc:
                logger.error(f"Failed to process attached image in voice turn: {exc}")

        # 4. Agentic RAG Clinical Orchestration Turn (8-node workflow)
        from app.agents.optiderma_agent import optiderma_workflow

        turn_result = optiderma_workflow.run_turn(
            query=effective_query,
            user_id=user_id or "patient_user",
            conversation_id=conversation_id,
            analysis_id=active_analysis_id,
            image_base64=image_b64,
        )

        answer_text = turn_result.get("answer", "")
        resolved_cid = turn_result.get("conversation_id", conversation_id or str(uuid.uuid4()))
        resolved_aid = turn_result.get("analysis_id", active_analysis_id)
        intent = turn_result.get("intent", "general_skin_education")
        citations = turn_result.get("citations", [])
        trace = turn_result.get("trace", {})

        # 5. Text-to-Speech (TTS) Synthesis
        audio_b64 = ""
        raw_audio_bytes = b""
        tts_provider = "none"
        spoken_text = ""

        if output_audio and answer_text:
            spoken_text = clean_text_for_speech(answer_text)
            logger.info(f"Synthesizing voice response ({len(spoken_text)} characters).")
            raw_audio_bytes, tts_provider = self.tts.synthesize(spoken_text)
            if raw_audio_bytes:
                audio_b64 = base64.b64encode(raw_audio_bytes).decode("utf-8")

        return {
            "ok": True,
            "transcript": transcript if transcription_status == "success" else "",
            "transcription_status": transcription_status,
            "effective_query": effective_query,
            "conversation_id": resolved_cid,
            "analysis_id": resolved_aid,
            "intent": intent,
            "answer": answer_text,
            "spoken_text": spoken_text,
            "audio_base64": audio_b64,
            "audio_bytes_length": len(raw_audio_bytes),
            "audio_format": "audio/mpeg",
            "tts_provider": tts_provider,
            "citations": citations,
            "citations_count": len(citations),
            "new_analysis_generated": new_analysis_record is not None,
            "trace": trace,
            "raw_audio_bytes": raw_audio_bytes,  # Available internally for streaming/binary endpoints
        }


# Global singleton instance
voice_turn_service = VoiceTurnService()
