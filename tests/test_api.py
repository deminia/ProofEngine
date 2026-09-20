"""Automated tests for engine/api.py niche routes.
Verifies:
1. GET /api/niche/active returns sanitized config (no secret sauce keywords if private)
2. POST /api/niche/switch switches active niche and validates target
3. GET /api/niche/list lists all packs with isPrivate and isActive flags
4. Zero niche-specific strings in engine/api.py
"""
import pytest
from pathlib import Path
from engine.api import get_active_niche, list_niches, switch_active_niche, SwitchNicheRequest
from engine.niche_loader import set_active_niche_override


@pytest.fixture(autouse=True)
def reset_active_override():
    set_active_niche_override(None)
    yield
    set_active_niche_override(None)


def test_get_active_niche_sanitized():
    """Test that active niche returns sanitized structure."""
    data = get_active_niche()
    assert "id" in data
    assert "storyBeats" in data
    assert "visual" in data
    assert "discoveryTiers" in data


def test_private_pack_sanitization():
    """Verify that private packs have secret keywords/examples stripped."""
    karma_path = Path(__file__).resolve().parent.parent / "niches" / "karma-th"
    if not karma_path.exists():
        pytest.skip("karma-th is a private pack not committed to public repo")
    # Switch to karma-th (private pack)
    switch_active_niche(SwitchNicheRequest(nicheId="karma-th"))
    data = get_active_niche()
    assert data["id"] == "karma-th"
    assert data["isPrivate"] is True
    
    # Check that categories exist for UI display but keywords/examples are stripped
    for tier in data["discoveryTiers"]:
        for cat in tier["categories"]:
            assert cat["keywords"] == [], "Private pack keywords must be sanitized from API!"
            assert cat["examples"] == [], "Private pack examples must be sanitized from API!"


def test_switch_niche():
    """Test switching active niche."""
    resp = switch_active_niche(SwitchNicheRequest(nicheId="_template"))
    assert resp["ok"] is True
    assert resp["activeNiche"] == "_template"
    
    active_data = get_active_niche()
    assert active_data["id"] == "_template"


def test_switch_to_invalid_niche_raises_error():
    """Test switching to non-existent niche raises 400 error."""
    with pytest.raises(Exception) as exc_info:
        switch_active_niche(SwitchNicheRequest(nicheId="non_existent_xyz"))
    assert "Cannot switch to niche" in str(exc_info.value)


def test_list_niches():
    """Test listing all niche packs on disk."""
    packs = list_niches()
    ids = [p["id"] for p in packs]
    assert "example-finance" in ids
    assert "_template" in ids
    karma_path = Path(__file__).resolve().parent.parent / "niches" / "karma-th"
    if karma_path.exists():
        assert "karma-th" in ids
    
    # Check active flag
    active_item = next(p for p in packs if p["isActive"])
    assert active_item is not None


def test_zero_niche_strings_in_api():
    """Ensure engine/api.py has zero hardcoded niche terms."""
    p = Path("D:/Demini/ProofEngine/engine/api.py")
    text = p.read_text(encoding="utf-8").lower()
    terms_file = Path("D:/Demini/ProofEngine/engine/forbidden_terms.txt")
    forbidden = [line.strip() for line in terms_file.read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#")]
    for term in forbidden:
        assert term not in text, f"engine/api.py contains forbidden term: {term}"
