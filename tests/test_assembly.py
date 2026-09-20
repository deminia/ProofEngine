"""Tests for engine/assembly.py (Video Assembly Engine)."""
import pytest
from pathlib import Path
from engine.assembly import (
    build_srt_subtitles,
    generate_motion_placeholder,
    acquire_footage_sequence,
    FootageClip,
)


def test_build_srt_subtitles(tmp_path):
    srt_out = tmp_path / "test.srt"
    script = "A day trader turned fifteen thousand dollars into one point two million. Then lost it all."
    path_res = build_srt_subtitles(script, total_duration=10.0, output_srt_path=str(srt_out))
    
    assert Path(path_res).exists()
    content = Path(path_res).read_text(encoding="utf-8")
    assert "-->" in content
    assert "1" in content
    assert "day trader" in content and "million" in content


def test_generate_motion_placeholder(tmp_path):
    clip_out = tmp_path / "placeholder.mp4"
    clip = generate_motion_placeholder(str(clip_out), duration=2.0)
    assert isinstance(clip, FootageClip)
    assert clip.source == "placeholder"
    assert Path(clip.file_path).exists()
    assert Path(clip.file_path).stat().st_size > 5000


def test_acquire_footage_sequence_fallback_when_no_api_key(tmp_path):
    keywords = ["chart plunging", "trader stressed", "empty account"]
    clips = acquire_footage_sequence(
        visual_keywords=keywords,
        total_duration=12.0,
        output_dir=tmp_path / "footage",
        pexels_api_key="",  # No key -> must fallback gracefully
    )
    assert len(clips) >= 2
    for c in clips:
        assert c.source == "placeholder"
        assert Path(c.file_path).exists()
