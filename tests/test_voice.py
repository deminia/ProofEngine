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
