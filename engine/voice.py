"""Universal Text-to-Speech Engine for ProofEngine.

Provides TTS synthesis behind a pluggable TTSProvider interface.
Strict Architectural Contract:
Voice generation strictly consumes the `VoiceSettings` pre-bound inside
`ScriptResult.voice_settings`. It NEVER calls `resolve_voice()` directly,
ensuring tier/category voice override resolution remains deterministic and centralized.
Zero niche-specific logic or hardcoded voices.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
import asyncio
import json
import logging
import os
from pathlib import Path
import shutil
import subprocess
from typing import Optional

from pydantic import BaseModel, Field

from .niche_loader import VoiceSettings
from .scripting import ScriptResult

log = logging.getLogger(__name__)


class AudioResult(BaseModel):
    """Result of an audio synthesis run."""
    audio_path: str = Field(..., description="Absolute path to the generated audio file")
    duration_seconds: float = Field(..., description="Exact duration of audio in seconds")
    voice_id: str = Field(..., description="Voice ID applied during generation")
    rate: str = Field(default="+0%", description="Speech speed adjustment applied")
    pitch: str = Field(default="+0Hz", description="Voice pitch adjustment applied")
    provider: str = Field(default="edge-tts", description="TTS backend provider name")


def get_audio_duration(file_path: str) -> float:
    """Measure the exact duration of an audio file using ffprobe or ffmpeg."""
    p = Path(file_path)
    if not p.exists() or p.stat().st_size == 0:
        return 0.0

    # Try ffprobe first
    if shutil.which("ffprobe"):
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(p),
        ]
        try:
            out = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode("utf-8").strip()
            return round(float(out), 2)
        except Exception as err:
            log.debug("ffprobe failed on %s: %s", file_path, err)

    # Fallback to ffmpeg -i
    if shutil.which("ffmpeg"):
        cmd = ["ffmpeg", "-i", str(p)]
        try:
            proc = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
            for line in proc.stderr.splitlines():
                if "Duration:" in line:
                    time_part = line.split("Duration:")[1].split(",")[0].strip()
                    h, m, s = time_part.split(":")
                    return round(float(h) * 3600 + float(m) * 60 + float(s), 2)
        except Exception as err:
            log.debug("ffmpeg duration parse failed: %s", err)

    return 0.0


class TTSProvider(ABC):
    """Abstract interface for text-to-speech providers."""

    @abstractmethod
    async def synthesize(
        self,
        text: str,
        voice_settings: VoiceSettings,
        output_path: str,
    ) -> AudioResult:
        """Synthesize text into speech file using provided settings."""
        pass


class EdgeTTSProvider(TTSProvider):
    """Free, high-quality neural TTS provider via Microsoft Edge TTS."""

    async def synthesize(
        self,
        text: str,
        voice_settings: VoiceSettings,
        output_path: str,
    ) -> AudioResult:
        import edge_tts

        out_path = Path(output_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)

        voice_id = voice_settings.voiceId
        rate = voice_settings.rate or "+0%"
        pitch = voice_settings.pitch or "+0Hz"

        communicate = edge_tts.Communicate(
            text=text,
            voice=voice_id,
            rate=rate,
            pitch=pitch,
        )
        await communicate.save(str(out_path))

        duration = get_audio_duration(str(out_path))
        if duration <= 0.0:
            # Fallback estimation if ffprobe not available
            words = len(text.split())
            duration = round(words / 3.0, 2)

        return AudioResult(
            audio_path=str(out_path.resolve()),
            duration_seconds=duration,
            voice_id=voice_id,
            rate=rate,
            pitch=pitch,
            provider="edge-tts",
        )


class MockTTSProvider(TTSProvider):
    """In-memory / stub provider for deterministic testing without external network calls."""

    def __init__(self, fixed_duration: float = 10.0):
        self.fixed_duration = fixed_duration

    async def synthesize(
        self,
        text: str,
        voice_settings: VoiceSettings,
        output_path: str,
    ) -> AudioResult:
        out_path = Path(output_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        # Write dummy audio header
        out_path.write_bytes(b"RIFFmockWAVEfmt ")
        return AudioResult(
            audio_path=str(out_path.resolve()),
            duration_seconds=self.fixed_duration,
            voice_id=voice_settings.voiceId,
            rate=voice_settings.rate,
            pitch=voice_settings.pitch,
            provider="mock-tts",
        )


def synthesize_voice(
    script: ScriptResult,
    output_path: str,
    provider: Optional[TTSProvider] = None,
) -> AudioResult:
    """Synthesize voice narration for a generated ScriptResult.
    
    IMPORTANT: This function directly consumes `script.voice_settings`.
    It NEVER attempts to resolve or override voices, ensuring centralized logic.
    """
    selected_provider = provider or EdgeTTSProvider()
    
    # Run async synthesize in event loop
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import nest_asyncio
        nest_asyncio.apply()
        return loop.run_until_complete(
            selected_provider.synthesize(script.body, script.voice_settings, output_path)
        )
    else:
        return asyncio.run(
            selected_provider.synthesize(script.body, script.voice_settings, output_path)
        )
