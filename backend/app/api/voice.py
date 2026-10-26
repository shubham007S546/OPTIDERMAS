"""Voice interaction API routes (STT and TTS)."""

from typing import Optional
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from app.services.stt_service import SpeechToTextService
from app.services.tts_service import TextToSpeechService

router = APIRouter(prefix="/voice", tags=["Voice"])


class TTSRequest(BaseModel):
    text: str


@router.post("/stt")
async def speech_to_text(file: UploadFile = File(...)):
    """Transcribe uploaded audio file into text transcript."""
    try:
        content = await file.read()
        stt = SpeechToTextService()
        transcript = stt.transcribe_audio_bytes(content, filename=file.filename or "audio.mp3")
        return {"transcript": transcript}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"STT failed: {exc}") from exc


@router.post("/tts")
def text_to_speech(request: TTSRequest):
    """Convert input text string into spoken MP3 audio byte stream."""
    try:
        tts = TextToSpeechService()
        audio_bytes = tts.generate_speech_bytes(request.text)
        if not audio_bytes:
            raise HTTPException(status_code=500, detail="Failed to synthesize audio stream.")
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"TTS failed: {exc}") from exc


@router.post("/turn")
async def voice_turn_alias(
    file: Optional[UploadFile] = File(None, description="Recorded voice audio file"),
    query: Optional[str] = None,
    analysis_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
):
    """Convenience alias for /api/v1/agent/voice-turn."""
    from app.services.voice_turn_service import voice_turn_service

    audio_bytes = await file.read() if file else None
    fname = file.filename if file else "input.mp3"
    result = voice_turn_service.process_voice_turn(
        audio_bytes=audio_bytes,
        audio_filename=fname,
        query_text=query,
        analysis_id=analysis_id,
        conversation_id=conversation_id,
    )
    result.pop("raw_audio_bytes", None)
    return result

