"""Agent Consultation & Spoken Voice-Turn Routes."""

from __future__ import annotations

import base64
from typing import Optional
from fastapi import APIRouter, File, Form, Header, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel, Field

from app.services.voice_turn_service import voice_turn_service

router = APIRouter(prefix="/agent", tags=["Agent"])


class VoiceTurnJsonRequest(BaseModel):
    """JSON payload for clients sending base64-encoded audio or text directly."""
    query: Optional[str] = Field(None, description="Patient text query or transcription fallback")
    audio_base64: Optional[str] = Field(None, description="Base64 encoded audio bytes (MP3, WAV, WEBM)")
    audio_filename: Optional[str] = Field("input.mp3", description="Audio filename with extension")
    image_base64: Optional[str] = Field(None, description="Base64 encoded skin lesion photograph")
    analysis_id: Optional[str] = Field(None, description="Active analysis UUID")
    conversation_id: Optional[str] = Field(None, description="Conversation session UUID")
    user_id: Optional[str] = Field("patient_user", description="Patient user identifier")
    output_audio: bool = Field(True, description="Whether to synthesize MP3 audio response")


@router.post("/voice-turn")
async def voice_turn_multipart(
    audio_file: Optional[UploadFile] = File(None, description="Recorded voice audio file (MP3/WAV/WEBM)"),
    image_file: Optional[UploadFile] = File(None, description="Optional dermoscopic lesion image"),
    query: Optional[str] = Form(None, description="Optional text query or symptom notes"),
    analysis_id: Optional[str] = Form(None, description="Optional canonical analysis UUID to ground answers"),
    conversation_id: Optional[str] = Form(None, description="Optional conversation session UUID"),
    user_id: Optional[str] = Form("patient_user", description="Patient identifier"),
    output_audio: bool = Form(True, description="Whether to generate MP3 speech synthesis"),
    response_format: Optional[str] = Query("json", description="'json' for structured response or 'audio' for raw MP3 byte stream"),
    accept: Optional[str] = Header(None),
):
    """Unified Spoken Voice-Turn Pipeline.

    Takes spoken audio from patient, runs Groq Whisper STT, optionally ingests skin lesion photograph,
    executes the 8-node Agentic RAG clinical reasoning engine with 34 dermatology guidelines,
    and synthesizes a fluent, natural MP3 speech response via ElevenLabs / gTTS.
    """
    try:
        audio_bytes = None
        audio_name = "input.mp3"
        if audio_file:
            audio_bytes = await audio_file.read()
            audio_name = audio_file.filename or "input.mp3"

        image_bytes = None
        if image_file:
            image_bytes = await image_file.read()

        result = voice_turn_service.process_voice_turn(
            audio_bytes=audio_bytes,
            audio_filename=audio_name,
            query_text=query,
            image_bytes=image_bytes,
            analysis_id=analysis_id,
            conversation_id=conversation_id,
            user_id=user_id,
            output_audio=output_audio,
        )

        # Check if caller wants binary audio stream directly
        wants_audio = (response_format and response_format.lower() == "audio") or (accept and "audio" in accept)
        if wants_audio and result.get("raw_audio_bytes"):
            raw_audio = result["raw_audio_bytes"]
            return Response(
                content=raw_audio,
                media_type="audio/mpeg",
                headers={
                    "X-Transcript": result.get("transcript", "")[:200],
                    "X-Conversation-ID": result.get("conversation_id", ""),
                    "X-Analysis-ID": result.get("analysis_id", "") or "",
                    "X-Intent": result.get("intent", ""),
                    "X-TTS-Provider": result.get("tts_provider", ""),
                    "Content-Disposition": 'inline; filename="response.mp3"',
                },
            )

        # Return full structured JSON payload (without bulky raw bytes object)
        result.pop("raw_audio_bytes", None)
        return result

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Voice turn execution failed: {exc}") from exc


@router.post("/voice-turn/json")
def voice_turn_json(
    req: VoiceTurnJsonRequest,
    response_format: Optional[str] = Query("json", description="'json' or 'audio'"),
):
    """JSON variant of the Spoken Voice-Turn Pipeline accepting base64 payloads."""
    try:
        audio_bytes = None
        if req.audio_base64:
            audio_bytes = base64.b64decode(req.audio_base64)

        image_bytes = None
        if req.image_base64:
            image_bytes = base64.b64decode(req.image_base64)

        result = voice_turn_service.process_voice_turn(
            audio_bytes=audio_bytes,
            audio_filename=req.audio_filename or "input.mp3",
            query_text=req.query,
            image_bytes=image_bytes,
            analysis_id=req.analysis_id,
            conversation_id=req.conversation_id,
            user_id=req.user_id,
            output_audio=req.output_audio,
        )

        if response_format and response_format.lower() == "audio" and result.get("raw_audio_bytes"):
            raw_audio = result["raw_audio_bytes"]
            return Response(
                content=raw_audio,
                media_type="audio/mpeg",
                headers={
                    "X-Transcript": result.get("transcript", "")[:200],
                    "X-Conversation-ID": result.get("conversation_id", ""),
                    "X-Analysis-ID": result.get("analysis_id", "") or "",
                    "X-Intent": result.get("intent", ""),
                    "X-TTS-Provider": result.get("tts_provider", ""),
                },
            )

        result.pop("raw_audio_bytes", None)
        return result

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Voice turn JSON execution failed: {exc}") from exc
