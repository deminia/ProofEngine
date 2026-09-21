"""Tests for engine/assembly.py (Video Assembly Engine)."""
import pytest
import shutil
import subprocess
from pathlib import Path
from engine.assembly import (
    build_srt_subtitles,
    build_ass_subtitles,
    sanitize_ass_text,
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


def test_sanitize_ass_text_special_characters():
    """Verify that curly braces, backslashes, and special characters are safely escaped/transformed."""
    raw = r'Options alert: {Risk: 100%}, not 50/50! \loss = $400,000 & "margin call" — wipeout.'
    sanitized = sanitize_ass_text(raw)
    
    # Braces replaced so LibASS does not swallow them as override tags
    assert "{" not in sanitized and "}" not in sanitized
    assert "(Risk: 100%)" in sanitized
    # Backslashes normalized to forward slash
    assert "\\" not in sanitized
    assert "/loss" in sanitized
    # Commas, dollar signs, ampersands, quotes, em-dashes preserved
    assert "$400,000" in sanitized
    assert "&" in sanitized
    assert '"margin call"' in sanitized
    assert "—" in sanitized


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg is required for this test")
def test_build_ass_subtitles_with_special_characters_and_ffmpeg_render(tmp_path):
    """Verify ASS subtitles with tricky characters render cleanly in FFmpeg without syntax errors."""
    ass_out = tmp_path / "test_special.ass"
    tricky_script = (
        'He yelled: "Profit {100%}, no risk!"\n'
        r'Then the broker sent a margin call ($300,000 & more), debt \ wiped him out — completely!'
    )
    res_path = build_ass_subtitles(tricky_script, total_duration=8.0, output_ass_path=str(ass_out))
    
    assert Path(res_path).exists()
    content = Path(res_path).read_text(encoding="utf-8")
    assert "[Script Info]" in content
    assert "PlayResX: 1080" in content
    assert "PlayResY: 1920" in content
    assert "Dialogue:" in content
    assert "(100%)" in content
    assert "$300,000" in content

    # Test FFmpeg dry run using libass filter to guarantee syntax correctness
    ass_escaped = Path(res_path).resolve().as_posix().replace(":", "\\:")
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", "color=c=black:s=1080x1920:d=1,fps=30",
        "-vf", f"ass='{ass_escaped}'",
        "-f", "null",
        "-"
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert proc.returncode == 0, f"FFmpeg failed to parse ASS with special characters: {proc.stderr}"


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg is required for this test")
def test_generate_motion_placeholder(tmp_path):
    clip_out = tmp_path / "placeholder.mp4"
    clip = generate_motion_placeholder(str(clip_out), duration=2.0)
    assert isinstance(clip, FootageClip)
    assert clip.source == "placeholder"
    assert Path(clip.file_path).exists()
    assert Path(clip.file_path).stat().st_size > 5000


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg is required for this test")
def test_acquire_footage_sequence_fallback_when_no_api_key(tmp_path):
    keywords = ["chart plunging", "trader stressed", "empty account"]
    clips = acquire_footage_sequence(
        visual_keywords=keywords,
        total_duration=12.0,
        output_dir=tmp_path / "footage",
        pexels_api_key="",  # No key -> must fallback gracefully to placeholders
    )
    assert len(clips) >= 2
    for c in clips:
        assert c.source == "placeholder"
        assert Path(c.file_path).exists()


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg is required for this test")
def test_acquire_footage_sequence_handles_unfindable_keywords_without_crashing(tmp_path, monkeypatch):
    """Verify that even with an API key, unfindable queries broaden or fallback to placeholder without crashing."""
    from engine import assembly

    # Simulate Pexels API returning 0 results for any query
    monkeypatch.setattr(assembly, "fetch_pexels_video", lambda query, output_dir, api_key: None)

    obscure_keywords = ["xyzunknownnonexistent9999", "qwertyuiopasdfghjkl", "completelyunmatchableterm"]
    clips = acquire_footage_sequence(
        visual_keywords=obscure_keywords,
        total_duration=10.0,
        output_dir=tmp_path / "unfindable_footage",
        pexels_api_key="fake_key_123",
    )
    assert len(clips) >= 2
    # Since all queries returned None, it must safely fallback to motion placeholders
    for c in clips:
        assert c.source == "placeholder"
        assert Path(c.file_path).exists()
