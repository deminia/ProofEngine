"""Automated tests for engine/screening.py.
Verifies:
1. Dynamic criteria & hardRejectRules prompt formatting from NichePack
2. Parsing of score, hook, reason, copyright risk, and criteria breakdown
3. Auto-approve threshold pass/fail logic
4. Resilience against unparseable LLM output
5. Zero niche-specific strings in screening.py
"""
import json
import pytest
from pathlib import Path

from engine.niche_loader import load_niche
from engine.screening import screen_story, build_screening_prompt, ScreeningResult


@pytest.fixture
def project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def test_build_screening_prompt(project_root):
    """Test that criteria and reject rules are dynamically injected into prompt."""
    pack = load_niche("example-finance", base_dir=project_root)
    prompt = build_screening_prompt("Sample Title", pack)
    
    assert "Sample Title" in prompt
    assert "financial-lesson" in prompt
    assert "shock-contrast" in prompt
    assert "unregulated financial advice" in prompt


def test_screen_story_passed(project_root):
    """Test story screening where score >= threshold (passed=True)."""
    pack = load_niche("example-finance", base_dir=project_root)
    
    mock_llm_response = json.dumps({
        "score": 8.5,
        "hook": "He lost $150,000 on options in 3 days!",
        "reason": "Clear lesson on leverage dangers with high shock contrast",
        "copyright_risk": "low",
        "copyright_note": "Can be represented entirely with stock footage and charts",
        "criteria_breakdown": {
            "financial-lesson": 9.0,
            "shock-contrast": 8.0,
            "retention-pacing": 8.5
        }
    })
    
    res = screen_story(
        title="College Trader Blowup",
        content="A 21-year-old student took out student loans to trade 0DTE options.",
        pack=pack,
        llm_complete=lambda prompt: mock_llm_response,
    )
    
    assert res.score == 8.5
    assert res.passed is True  # 8.5 >= 7.0
    assert "150,000" in res.hook
    assert res.copyright_risk == "low"
    assert res.criteria_breakdown["financial-lesson"] == 9.0


def test_screen_story_rejected(project_root):
    """Test story screening where score < threshold (passed=False)."""
    pack = load_niche("example-finance", base_dir=project_root)
    
    mock_llm_response = json.dumps({
        "score": 4.0,
        "hook": "Man opens savings account.",
        "reason": "Lacks tension, drama, or actionable insight.",
        "copyright_risk": "low",
        "copyright_note": "Stock available",
        "criteria_breakdown": {"financial-lesson": 4.0}
    })
    
    res = screen_story(
        title="Boring Banking Day",
        content="Someone deposited $100 into a checking account with 0.01% APY.",
        pack=pack,
        llm_complete=lambda prompt: mock_llm_response,
    )
    
    assert res.score == 4.0
    assert res.passed is False  # 4.0 < 7.0
    assert res.hook == "Man opens savings account."


def test_screen_story_unparseable_output(project_root):
    """Test graceful handling when LLM returns non-JSON garbage."""
    pack = load_niche("example-finance", base_dir=project_root)
    
    res = screen_story(
        title="Broken Response",
        content="Any content",
        pack=pack,
        llm_complete=lambda prompt: "I am an AI and I cannot output JSON right now sorry.",
    )
    
    assert res.score == 0.0
    assert res.passed is False
    assert "failed to return valid JSON" in res.reason


def test_zero_niche_strings_in_screening(project_root):
    """Ensure engine/screening.py contains zero hardcoded niche terms."""
    file_path = project_root / "engine" / "screening.py"
    text = file_path.read_text(encoding="utf-8").lower()
    forbidden = ["karma", "ghost", "theranos", "madoff", "supernatural", "underdog"]
    for term in forbidden:
        assert term not in text, f"engine/screening.py contains forbidden term: {term}"
