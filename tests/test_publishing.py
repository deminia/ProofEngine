"""Automated tests for engine/publishing.py (Multi-Platform Publishing Engine).

Verifies:
1. Caption template rendering using active niche pack
2. Every caption template in example-finance renders cleanly without broken tags
3. Platform adapter registry lookup and canonical names/aliases
4. Strict DRY-RUN default behavior across all adapters (no network calls)
5. Credential validation reporting missing variables
6. Schedule and publish state persistence via PublishStateManager
7. Multi-platform publish orchestrator dispatching to configured platforms
8. Zero niche-specific strings in publishing.py
"""
import json
import pytest
from pathlib import Path

from engine.niche_loader import load_niche
from engine.publishing import (
    ADAPTER_REGISTRY,
    PublishPayload,
    PublishResult,
    PublishStateManager,
    get_adapter,
    get_platform_caption,
    list_supported_platforms,
    publish_all_platforms,
    publish_to_platform,
    render_caption,
)


@pytest.fixture
def sample_video(tmp_path) -> Path:
    vid = tmp_path / "sample_short.mp4"
    vid.write_bytes(b"dummy_mp4_content_for_testing")
    return vid


def test_render_caption():
    template = "{{title}}\n\n{{description}}\n\n{{hashtags}}\n\n{{factCheckDisclaimer}}"
    caption = render_caption(
        template=template,
        title="From $15K to $1.2M",
        description="Alex traded meme stocks and got leverage trapped.",
        hashtags="#finance #moneytok",
        disclaimer="Educational only.",
    )
    assert "From $15K to $1.2M" in caption
    assert "Alex traded meme stocks" in caption
    assert "#finance #moneytok" in caption
    assert "Educational only." in caption
    assert "{{" not in caption and "}}" not in caption


def test_all_example_finance_caption_templates_render(project_root):
    """Verify that every single platform template defined in example-finance renders without unparsed tags."""
    pack = load_niche("example-finance", base_dir=project_root)
    templates = pack.config.social.captionTemplates
    assert len(templates) >= 4

    title = "The $400K Margin Call"
    desc = "Why leverage destroys accounts."
    tags = "#finance #investing #stocks"

    for platform, tmpl in templates.items():
        rendered = render_caption(tmpl, title=title, description=desc, hashtags=tags)
        assert len(rendered) > 10, f"Template for {platform} rendered empty!"
        assert "{{" not in rendered and "}}" not in rendered, f"Unparsed tag in {platform}: {rendered}"
        assert title in rendered or tags in rendered, f"Neither title nor tags in {platform} caption!"


def test_adapter_registry():
    supported = list_supported_platforms()
    assert "youtube" in supported
    assert "tiktok" in supported
    assert "instagram" in supported
    assert "facebook" in supported
    assert "x" in supported
    assert "shopee" in supported

    # Test direct names and aliases
    assert get_adapter("youtube").name == "youtube"
    assert get_adapter("tiktok").name == "tiktok"
    assert get_adapter("instagram").name == "instagram"
    assert get_adapter("facebook").name == "facebook"
    assert get_adapter("x").name == "x"
    assert get_adapter("twitter").name == "x"
    assert get_adapter("shopee").name == "shopee"
    assert get_adapter("shopee_video").name == "shopee"
    assert get_adapter("unknown_platform_xyz") is None


@pytest.mark.asyncio
async def test_dry_run_is_default_and_does_not_network(sample_video):
    """Verify that calling publish() on any adapter defaults to dry_run=True and makes zero HTTP requests."""
    for plat_name in ["youtube", "tiktok", "instagram", "facebook", "x", "shopee"]:
        adapter = get_adapter(plat_name)
        payload = adapter.build_payload(
            video_path=str(sample_video),
            caption=f"Test caption for {plat_name} #test",
            title=f"Test {plat_name}",
        )

        # Call publish WITHOUT passing dry_run argument -> must default to dry_run=True
        result = await adapter.publish(payload)
        
        assert isinstance(result, PublishResult)
        assert result.platform == adapter.name
        assert result.dry_run is True
        assert result.status == "dry_run"
        assert result.success is True
        assert result.external_id is not None
        assert "dryrun" in result.external_id
        assert result.post_url is not None


def test_validate_credentials_reports_missing(monkeypatch):
    """Verify validate_credentials identifies missing environment variables."""
    for plat in ["youtube", "tiktok", "instagram", "facebook", "x", "shopee"]:
        adapter = get_adapter(plat)
        # Clear all possible env vars
        for var in [
            "YOUTUBE_CLIENT_SECRET_FILE", "YOUTUBE_TOKEN_FILE", "YOUTUBE_API_KEY",
            "TIKTOK_ACCESS_TOKEN",
            "META_ACCESS_TOKEN", "META_IG_USER_ID", "META_PAGE_ID",
            "X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET",
            "SHOPEE_PARTNER_ID", "SHOPEE_PARTNER_KEY", "SHOPEE_SHOP_ID", "SHOPEE_ACCESS_TOKEN",
        ]:
            monkeypatch.delenv(var, raising=False)

        valid, missing = adapter.validate_credentials()
        assert valid is False
        assert len(missing) > 0


def test_state_manager_record_and_retrieve(tmp_path):
    state_file = tmp_path / "publish_state.json"
    mgr = PublishStateManager(str(state_file))

    res_yt = PublishResult(
        platform="youtube",
        status="published",
        success=True,
        external_id="yt_12345",
        post_url="https://youtube.com/shorts/12345",
        dry_run=False,
    )
    res_tt = PublishResult(
        platform="tiktok",
        status="dry_run",
        success=True,
        external_id="tt_dryrun_123",
        dry_run=True,
    )

    mgr.record_publish("vid_001", res_yt)
    mgr.record_publish("vid_001", res_tt)

    status = mgr.get_status("vid_001")
    assert "youtube" in status["platforms"]
    assert status["platforms"]["youtube"]["status"] == "published"
    assert status["platforms"]["tiktok"]["status"] == "dry_run"

    # Verify listing compatible with Dashboard
    posts = mgr.list_all_posts()
    assert len(posts) == 2
    post_map = {p["platform"]: p for p in posts}
    assert post_map["youtube"]["status"] == "published"
    assert post_map["youtube"]["external_id"] == "yt_12345"


def test_publish_all_platforms_orchestrator(sample_video, project_root, tmp_path):
    pack = load_niche("example-finance", base_dir=project_root)
    state_mgr = PublishStateManager(str(tmp_path / "state.json"))

    results = publish_all_platforms(
        video_path=str(sample_video),
        title="Test Finance Title",
        description="Test description of debt blunders.",
        hashtags="#finance #money",
        pack=pack,
        dry_run=True,  # Default dry run
        state_manager=state_mgr,
        video_id="video_smoke_001",
    )

    assert len(results) >= 3
    for plat, res in results.items():
        assert res.dry_run is True
        assert res.status == "dry_run"
        assert res.success is True

    # Check dashboard state reflection
    persisted = state_mgr.get_status("video_smoke_001")
    assert len(persisted["platforms"]) == len(results)


def test_zero_niche_strings_in_publishing(project_root):
    """Ensure engine/publishing.py contains zero forbidden terms."""
    file_path = project_root / "engine" / "publishing.py"
    text = file_path.read_text(encoding="utf-8").lower()
    forbidden = ["karma", "ghost", "theranos", "madoff", "supernatural", "underdog"]
    for term in forbidden:
        assert term not in text, f"engine/publishing.py contains forbidden term: {term}"
