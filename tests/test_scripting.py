"""Automated tests for engine/scripting.py.
Verifies:
1. Dynamic beat iteration from active NichePack (no hardcoded beat labels)
2. Voice override binding into ScriptResult
3. Parsing of title, body, keywords, variants, duration estimation
4. Global adaptation via adapt_to_global
5. Zero niche-specific strings in scripting.py
"""
import json
import pytest
from pathlib import Path

from engine.niche_loader import load_niche
from engine.scripting import (
    generate_script,
    adapt_to_global,
    build_script_prompt,
    estimate_duration_seconds,
    ScriptResult,
)


@pytest.fixture
def project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def test_build_script_prompt_iterates_beats(project_root):
    """Verify that all beats from the niche pack are formatted into the prompt."""
    pack = load_niche("example-finance", base_dir=project_root)
    prompt = build_script_prompt("Sample Title", pack, duration=55)
    
    # Ensure beats from example-finance are included
    assert "THE PROMISE" in prompt or "HOOK" in prompt
    assert "THE TRAP" in prompt or "BREAKDOWN" in prompt
    assert "THE WEALTH LESSON" in prompt or "LESSON" in prompt
    assert "55" in prompt


def test_generate_script_with_voice_binding(project_root):
    """Test script generation and verify voice settings resolution."""
    pack = load_niche("example-finance", base_dir=project_root)
    
    mock_llm_response = json.dumps({
        "title": "The $12,000 Car Loan Trap",
        "body": "HOOK: You think you bought a car for $25,000.\n\nSETUP: But the dealer stretched the loan to 84 months.\n\nLESSON: You paid $12,000 in pure interest. Never finance over 48 months.",
        "hook_score": 9.0,
        "hook_reason": "High emotional contrast on wasted interest",
        "hashtags": "#finance #moneytips #cartrap",
        "description": "How 84 month auto loans quietly steal your wealth.",
        "visual_keywords": [
            "car dealership handshake dramatic",
            "calculator paper loan contract close up",
            "stressed driver steering wheel dim light"
        ],
        "hook_variants": [
            "This 84-month loan costs more than the car itself!",
            "Why your $25k car really costs $37k.",
            "The financing trick car salesmen don't want you to calculate."
        ]
    })
    
    res = generate_script(
        title="Car Loan Disaster",
        content="Dealer slipped 29% APR into an 84-month contract.",
        pack=pack,
        target_duration=50,
        llm_complete=lambda p: mock_llm_response,
    )
    
    assert res.title == "The $12,000 Car Loan Trap"
    assert "25,000" in res.body
    assert res.hook_score == 9.0
    assert len(res.visual_keywords) == 3
    assert len(res.hook_variants) == 3
    assert res.target_duration == 50
    assert res.voice_settings.voiceId == "en-US-ChristopherNeural"
    assert len(res.beats) == len(pack.config.storyBeats)


def test_adapt_to_global(project_root):
    """Test adapting a script to global English."""
    pack = load_niche("example-finance", base_dir=project_root)
    
    mock_global_response = "You thought your new car cost $25,000. But that 84-month loan secretly added $12,000 in interest."
    
    adapted = adapt_to_global(
        script_body="Original script text here",
        pack=pack,
        cultural_notes="Focus on universal dollar impacts",
        llm_complete=lambda p: mock_global_response,
    )
    
    assert "25,000" in adapted
    assert "$12,000" in adapted


def test_estimate_duration_seconds():
    """Verify calibrated word-count and character-based duration estimation."""
    text = "one two three four five six seven eight nine ten"
    # 10 words at calibrated default 2.1 wps ≈ 4.8 seconds
    est = estimate_duration_seconds(text)
    assert 4.0 <= est <= 5.5

    # Explicit words_per_second override
    est_custom = estimate_duration_seconds(text, words_per_second=3.2)
    assert 2.5 <= est_custom <= 3.5


def test_zero_niche_strings_in_scripting(project_root):
    """Ensure engine/scripting.py contains zero hardcoded niche terms."""
    file_path = project_root / "engine" / "scripting.py"
    text = file_path.read_text(encoding="utf-8").lower()
    forbidden = ["karma", "ghost", "theranos", "madoff", "supernatural", "underdog"]
    for term in forbidden:
        assert term not in text, f"engine/scripting.py contains forbidden term: {term}"
