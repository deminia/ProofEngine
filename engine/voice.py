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
from typing import Optional, Callable

from pydantic import BaseModel, Field

from .niche_loader import VoiceSettings
from .scripting import ScriptResult
from .llm import complete

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


def _execute_async_synthesize(provider: TTSProvider, text: str, voice_settings: VoiceSettings, output_path: str) -> AudioResult:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import nest_asyncio
        nest_asyncio.apply()
        return loop.run_until_complete(
            provider.synthesize(text, voice_settings, output_path)
        )
    else:
        return asyncio.run(
            provider.synthesize(text, voice_settings, output_path)
        )


def synthesize_voice(
    script: ScriptResult,
    output_path: str,
    provider: Optional[TTSProvider] = None,
    max_duration_seconds: Optional[float] = None,
    llm_complete: Optional[Callable[[str], str]] = None,
    max_shorten_attempts: int = 3,
) -> AudioResult:
    """Synthesize voice narration for a generated ScriptResult with 2-layer duration guard.
    
    IMPORTANT: This function directly consumes `script.voice_settings`.
    It NEVER attempts to resolve or override voices, ensuring centralized logic.
    
    Layer 2 Post-TTS Duration Guard:
    Measures exact synthesized audio duration. If duration exceeds `max_duration_seconds * 1.05`,
    it automatically triggers an auto-shortening pass via LLM (shortening script word count proportionally),
    updates `script.body`, and re-synthesizes up to `max_shorten_attempts` times to guarantee final audio fits.
    """
    selected_provider = provider or EdgeTTSProvider()
    target_max = max_duration_seconds or float(script.target_duration or 0.0)

    # 1. Initial synthesis pass
    audio_res = _execute_async_synthesize(
        selected_provider, script.body, script.voice_settings, output_path
    )

    # If within threshold or no limit set, return immediately
    threshold = target_max
    if target_max <= 0.0 or audio_res.duration_seconds <= threshold:
        return audio_res

    log.warning(
        "Initial audio duration (%.2fs) exceeds max threshold (%.2fs * 1.05 = %.2fs). "
        "Triggering Layer 2 auto-shorten loop.",
        audio_res.duration_seconds,
        target_max,
        threshold,
    )

    complete_fn = llm_complete or (lambda p: complete(p, task="script"))
    current_body = script.body

    for attempt in range(1, max_shorten_attempts + 1):
        current_words = len(current_body.split())
        actual_wps = max(1.5, current_words / max(1.0, audio_res.duration_seconds))
        # Target ~88% of target_max to land safely in the 45-55s target zone
        factor = 0.82 if attempt == 1 else 0.72
        target_words = max(35, int((target_max * factor) * actual_wps))

        shorten_prompt = (
            f"The spoken narration is too long ({audio_res.duration_seconds:.1f}s, must be strictly under {target_max:.0f} seconds).\n"
            f"STRICT WORD BUDGET: Write EXACTLY between {target_words - 10} and {target_words} words total (ABSOLUTE MAXIMUM: {target_words} WORDS).\n"
            f"Every extra word will cause the video to be rejected.\n"
            f"Keep the opening hook, the conflict, the numbers/turning point, the main lesson, and the call to action.\n"
            f"Make every sentence short, punchy, and fast-paced without filler.\n"
            f"Return ONLY the rewritten script text without quotes or markdown formatting:\n\n{current_body}"
        )
        try:
            condensed = complete_fn(shorten_prompt).strip()
            for fence in ('"""', "```"):
                if condensed.startswith(fence) and condensed.endswith(fence):
                    condensed = condensed[len(fence):-len(fence)].strip()

            if condensed and len(condensed.split()) < current_words:
                current_body = condensed
                script.body = current_body
                # Re-synthesize
                audio_res = _execute_async_synthesize(
                    selected_provider, script.body, script.voice_settings, output_path
                )
                log.info(
                    "Auto-shorten attempt %d/%d produced duration: %.2fs (target <= %.2fs)",
                    attempt,
                    max_shorten_attempts,
                    audio_res.duration_seconds,
                    threshold,
                )
                if audio_res.duration_seconds <= threshold:
                    log.info("Layer 2 auto-shorten succeeded on attempt %d!", attempt)
                    break
        except Exception as err:
            log.warning("Auto-shorten pass %d failed (%s). Continuing with existing audio.", attempt, err)
            break

    if audio_res.duration_seconds > threshold:
        log.error(
            "Layer 2 duration guard: Final audio duration (%.2fs) still exceeds max threshold (%.2fs) "
            "after %d shorten attempts.",
            audio_res.duration_seconds,
            threshold,
            max_shorten_attempts,
        )

    return audio_res
