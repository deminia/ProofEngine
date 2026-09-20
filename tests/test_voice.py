from pathlib import Path
"""Tests for engine/voice.py (Text-to-Speech Engine)."""
import pytest
from engine.niche_loader import VoiceSettings
from engine.scripting import ScriptResult
from engine.voice import MockTTSProvider, synthesize_voice, AudioResult


def test_synthesize_voice_consumes_script_voice_settings_strictly(tmp_path):
    out_audio = tmp_path / "voice_output.mp3"
    
    # Custom pre-bound voice settings
    custom_voice = VoiceSettings(
        voiceId="en-US-GuyNeural",
        rate="+5%",
        pitch="-2Hz",
    )
    
    script = ScriptResult(
        title="Test Script",
        body="This is an educational personal finance test script.",
        voice_settings=custom_voice,
        target_duration=50,
        estimated_duration=48.0,
    )
    
    mock_provider = MockTTSProvider(fixed_duration=49.5)
    res = synthesize_voice(script, str(out_audio), provider=mock_provider)
    
    assert isinstance(res, AudioResult)
    assert res.voice_id == "en-US-GuyNeural"
    assert res.rate == "+5%"
    assert res.pitch == "-2Hz"
    assert res.duration_seconds == 49.5
    assert out_audio.exists()


def test_layer2_duration_guard_triggers_auto_shorten_when_exceeding_threshold(tmp_path):
    """Verify that Layer 2 post-TTS guard catches audio exceeding threshold and triggers auto-shorten loop."""
    out_audio = tmp_path / "voice_long.mp3"
    custom_voice = VoiceSettings(voiceId="en-US-ChristopherNeural", rate="+2%")
    
    script = ScriptResult(
        title="Long Script",
        body="This is a very long script that takes way too long to read out loud. " * 5,
        voice_settings=custom_voice,
        target_duration=50,  # Max allowed 50 * 1.05 = 52.5s
        estimated_duration=85.0,
    )

    call_count = {"tts": 0, "llm": 0}

    class DynamicDurationMockTTS(MockTTSProvider):
        async def synthesize(self, text, voice_settings, output_path):
            call_count["tts"] += 1
            dur = 85.0 if call_count["tts"] == 1 else 48.0
            out_p = Path(output_path)
            out_p.parent.mkdir(parents=True, exist_ok=True)
            out_p.write_bytes(b"RIFFmockWAVEfmt ")
            return AudioResult(
                audio_path=str(out_p.resolve()),
                duration_seconds=dur,
                voice_id=voice_settings.voiceId,
                rate=voice_settings.rate,
                pitch=voice_settings.pitch,
                provider="mock-tts",
            )

    def mock_shorten_llm(prompt: str) -> str:
        call_count["llm"] += 1
        return "Shortened punchy script that fits within duration."

    provider = DynamicDurationMockTTS()
    res = synthesize_voice(
        script=script,
        output_path=str(out_audio),
        provider=provider,
        max_duration_seconds=50.0,
        llm_complete=mock_shorten_llm,
    )

    assert call_count["tts"] == 2  # 1 initial + 1 after auto-shorten
    assert call_count["llm"] == 1  # 1 LLM condensation pass
    assert res.duration_seconds == 48.0
    assert script.body == "Shortened punchy script that fits within duration."


def test_layer2_duration_guard_passes_immediately_when_within_threshold(tmp_path):
    """Verify that Layer 2 post-TTS guard does NOT trigger auto-shorten when audio is within bounds."""
    out_audio = tmp_path / "voice_ok.mp3"
    custom_voice = VoiceSettings(voiceId="en-US-ChristopherNeural", rate="+2%")
    
    script = ScriptResult(
        title="Good Script",
        body="Properly paced script within limits.",
        voice_settings=custom_voice,
        target_duration=50,
        estimated_duration=48.0,
    )

    llm_called = False

    def mock_shorten_llm(prompt: str) -> str:
        nonlocal llm_called
        llm_called = True
        return "Should not be called"

    mock_provider = MockTTSProvider(fixed_duration=49.0)
    res = synthesize_voice(
        script=script,
        output_path=str(out_audio),
        provider=mock_provider,
        max_duration_seconds=50.0,
        llm_complete=mock_shorten_llm,
    )

    assert not llm_called
    assert res.duration_seconds == 49.0
