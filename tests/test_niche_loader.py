import re
"""Automated unit and regression tests for ProofEngine Niche Loader.
Validates:
1. Valid niche packs (karma-th, _template, example-finance)
2. Fallback resolution when active niche is unspecified (defaults to example-finance)
3. Environment variable override (NICHE)
4. Schema validation errors (missing required fields, invalid ranges)
5. Voice v1.1 override resolution per tier and category
6. Prompt variable rendering (including safety against backreference injection)
7. Prompt fallback to _template when a custom pack omits a prompt file
8. Zero niche-specific strings inside engine/ code (loaded from forbidden_terms.txt)
"""
import os
import json
import shutil
import pytest
from pathlib import Path
from engine.niche_loader import (
    load_niche,
    render_prompt,
    NicheValidationError,
    find_project_root,
)


@pytest.fixture
def project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def test_load_example_finance_pack(project_root):
    """Test loading the public default example-finance pack."""
    pack = load_niche("example-finance", base_dir=project_root)
    assert pack.config.id == "example-finance"
    assert "Finance" in pack.config.name or "Money" in pack.config.name
    assert len(pack.config.discoveryTiers) >= 3
    assert pack.config.visual.captionStyle.highlightColor == "#22c55e"


def test_default_active_niche_is_example_finance(project_root, monkeypatch):
    """Verify default active niche in public config is example-finance."""
    monkeypatch.delenv("NICHE", raising=False)
    pack = load_niche(base_dir=project_root)
    assert pack.config.id == "example-finance"


def test_load_karma_th_pack(project_root):
    """Test loading the primary karma-th production pack."""
    pack = load_niche("karma-th", base_dir=project_root)
    assert pack.config.id == "karma-th"
    assert pack.config.name == "Karma & Justice Stories"
    assert pack.config.languages.primary.code == "th"
    assert pack.config.languages.global_.code == "en"
    
    # Check discovery tiers
    assert len(pack.config.discoveryTiers) >= 9
    tier_ids = [t.id for t in pack.config.discoveryTiers]
    assert "s" in tier_ids
    assert "g" in tier_ids
    
    # Check screening rubric
    assert pack.config.screening.autoApproveThreshold == 7.0
    assert len(pack.config.screening.criteria) >= 5
    assert len(pack.config.screening.hardRejectRules) >= 5
    
    # Check story beats
    assert len(pack.config.storyBeats) == 6
    assert pack.config.storyBeats[0].id == "hook"
    assert pack.config.storyBeats[-1].id == "cta"
    
    # Check voice config
    assert pack.config.voice.provider == "edge-tts"
    assert "th-TH" in pack.config.voice.primary.voiceId
    assert "en-US" in pack.config.voice.global_.voiceId
    
    # Check prompts loaded
    assert "{{story}}" in pack.prompts.screening
    assert "{{beats}}" in pack.prompts.script_primary
    assert "{{culturalNotes}}" in pack.prompts.script_global


def test_voice_v1_1_override_resolution(project_root):
    """Test v1.1 voice overrides: Tier G resolves to AdisornNeural."""
    pack = load_niche("karma-th", base_dir=project_root)
    
    v_s = pack.config.voice.resolve_voice(tier_id="s")
    assert "Premwadee" in v_s.voiceId
    
    v_g = pack.config.voice.resolve_voice(tier_id="g")
    assert "Adisorn" in v_g.voiceId
    
    v_global = pack.config.voice.resolve_voice(lang="global")
    assert "Christopher" in v_global.voiceId


def test_load_template_pack(project_root):
    """Test loading the baseline _template pack."""
    pack = load_niche("_template", base_dir=project_root)
    assert pack.config.id == "_template"
    assert len(pack.config.storyBeats) >= 1
    assert pack.prompts.screening != ""


def test_prompt_fallback_to_template(project_root, tmp_path):
    """Test that omitting a prompt file in a custom pack falls back to _template/prompts/."""
    test_root = tmp_path / "test_repo"
    test_niches = test_root / "niches"
    test_niches.mkdir(parents=True)
    
    shutil.copytree(project_root / "niches" / "_template", test_niches / "_template")
    
    custom_pack_dir = test_niches / "custom-pack"
    custom_pack_dir.mkdir()
    (custom_pack_dir / "prompts").mkdir()
    
    custom_niche_data = json.loads((test_niches / "_template" / "niche.json").read_text(encoding="utf-8"))
    custom_niche_data["id"] = "custom-pack"
    custom_niche_data["name"] = "Custom Pack With Fallback"
    (custom_pack_dir / "niche.json").write_text(json.dumps(custom_niche_data), encoding="utf-8")
    
    (custom_pack_dir / "prompts" / "screening.md").write_text("Custom screening prompt", encoding="utf-8")
    (custom_pack_dir / "prompts" / "script_primary.md").write_text("Custom primary prompt", encoding="utf-8")
    
    pack = load_niche("custom-pack", base_dir=test_root)
    assert pack.prompts.screening == "Custom screening prompt"
    assert pack.prompts.script_primary == "Custom primary prompt"
    template_global = (test_niches / "_template" / "prompts" / "script_global.md").read_text(encoding="utf-8")
    assert pack.prompts.script_global == template_global


def test_niche_env_var_override(project_root, monkeypatch):
    """Test that the NICHE env var correctly controls which pack is loaded."""
    monkeypatch.setenv("NICHE", "example-finance")
    pack = load_niche(base_dir=project_root)
    assert pack.config.id == "example-finance"

    monkeypatch.setenv("NICHE", "_template")
    pack = load_niche(base_dir=project_root)
    assert pack.config.id == "_template"


def test_missing_niche_pack_raises_error(project_root):
    """Test that requesting a non-existent niche pack raises NicheValidationError."""
    with pytest.raises(NicheValidationError) as exc_info:
        load_niche("non_existent_niche_pack_xyz", base_dir=project_root)
    assert "not found" in str(exc_info.value).lower()


def test_invalid_score_threshold(project_root, tmp_path):
    """Test that threshold outside scoreRange fails schema validation."""
    test_root = tmp_path / "test_root"
    test_niches = test_root / "niches"
    test_niches.mkdir(parents=True)
    shutil.copytree(project_root / "niches" / "_template", test_niches / "_template")

    data = json.loads((test_niches / "_template" / "niche.json").read_text(encoding="utf-8"))
    data["id"] = "bad-pack"
    data["screening"]["scoreRange"] = [0, 10]
    data["screening"]["autoApproveThreshold"] = 15.0  # Invalid! > 10
    
    bad_pack = test_niches / "bad-pack"
    bad_pack.mkdir()
    (bad_pack / "niche.json").write_text(json.dumps(data), encoding="utf-8")

    with pytest.raises(NicheValidationError) as exc_info:
        load_niche("bad-pack", base_dir=test_root)
    assert "autoApproveThreshold" in str(exc_info.value) or "scoreRange" in str(exc_info.value)


def test_missing_required_field(project_root, tmp_path):
    """Test that missing required fields produces informative validation errors."""
    bad_pack_dir = tmp_path / "niches" / "missing-beats"
    bad_pack_dir.mkdir(parents=True)
    
    bad_data = {
        "id": "missing-beats",
        "name": "Missing Beats Niche",
        "languages": {"primary": {"code": "en", "label": "English"}},
        "screening": {"scoreRange": [0, 10], "autoApproveThreshold": 7.0},
        "voice": {"primary": {"voiceId": "voice-1"}},
        "visual": {},
        "social": {},
        "publishing": {}
    }
    (bad_pack_dir / "niche.json").write_text(json.dumps(bad_data), encoding="utf-8")

    with pytest.raises(NicheValidationError) as exc_info:
        load_niche("missing-beats", base_dir=tmp_path)
    assert "storyBeats" in str(exc_info.value)


def test_prompt_rendering():
    """Test render_prompt helper with variables and list structures."""
    template = "Story: {{story}}\nRules:\n{{rules}}\nScore threshold: {{threshold}}"
    rendered = render_prompt(
        template,
        {
            "story": "Test Headline",
            "rules": ["Rule 1", "Rule 2"],
            "threshold": 7.5,
        },
    )
    assert "Story: Test Headline" in rendered
    assert "- Rule 1" in rendered
    assert "- Rule 2" in rendered
    assert "Score threshold: 7.5" in rendered


def test_render_prompt_safe_against_backreferences():
    """Verify that variable content containing regex backreferences is safely replaced."""
    template = "Summary: {{summary}}"
    variables = {"summary": "Look at \\1 and \\g<0> test symbols"}
    rendered = render_prompt(template, variables)
    assert "Look at \\1 and \\g<0> test symbols" in rendered


def test_zero_niche_strings_in_engine(project_root):
    """CI Acceptance Criteria: Zero niche-specific strings in engine/ directory (reads forbidden_terms.txt)."""
    engine_dir = project_root / "engine"
    terms_file = engine_dir / "forbidden_terms.txt"
    forbidden_terms = [
        line.strip().lower()
        for line in terms_file.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    ]
    
    matches = []
    for py_file in engine_dir.rglob("*.py"):
        text = py_file.read_text(encoding="utf-8").lower()
        for term in forbidden_terms:
            pattern = rf"\b{re.escape(term)}\b"
            if re.search(pattern, text):
                matches.append(f"{py_file.name} contains forbidden niche term: '{term}'")
                
    assert not matches, "\n".join(matches)


def test_zero_niche_strings_in_dashboard_src(project_root):
    """CI Acceptance Criteria: Zero niche-specific strings in dashboard/src/ directory."""
    dashboard_src = project_root / "dashboard" / "src"
    if not dashboard_src.exists():
        return
    terms_file = project_root / "engine" / "forbidden_terms.txt"
    forbidden_terms = [
        line.strip().lower()
        for line in terms_file.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    ]
    
    matches = []
    for p in dashboard_src.rglob("*"):
        if p.is_file() and p.suffix in (".js", ".jsx", ".ts", ".tsx", ".css", ".html"):
            text = p.read_text(encoding="utf-8", errors="ignore").lower()
            for term in forbidden_terms:
                pattern = rf"\b{re.escape(term)}\b"
                if re.search(pattern, text):
                    matches.append(f"{p.name} contains forbidden niche term: '{term}'")
                    
    assert not matches, "\n".join(matches)
