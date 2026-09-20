"""Tests for engine/ingestion.py (Story Ingestion Engine)."""
import pytest
from engine.ingestion import compute_story_hash, intake_manual, intake_rss, clean_html, IngestedStory
from engine.niche_loader import load_niche


def test_compute_story_hash_deterministic():
    url = "https://example.com/news/12345"
    h1 = compute_story_hash(url, "Some Title")
    h2 = compute_story_hash(url, "Different Title")
    assert h1 == h2
    assert len(h1) == 16


def test_compute_story_hash_fallback_to_title():
    h1 = compute_story_hash(None, "Meme stock trader story")
    h2 = compute_story_hash("", "Meme stock trader story")
    assert h1 == h2
    assert len(h1) == 16


def test_intake_manual_preserves_raw_story(project_root):
    pack = load_niche("example-finance", base_dir=project_root)
    story = intake_manual(
        title="Day Trader Blowup with Crypto",
        content="He got caught in a crypto rug pull and lost his entire life savings.",
        source_url="https://news.example.com/crypto-loss",
        extra_metadata={"author": "TraderBob", "upvotes": 42},
        pack=pack,
    )
    assert isinstance(story, IngestedStory)
    assert len(story.id) == 16
    assert story.source_type == "manual"
    assert story.raw_story["author"] == "TraderBob"
    assert story.raw_story["upvotes"] == 42
    # Verify auto category tagging from keyword "crypto"
    assert story.tier_id is not None
    assert story.category_id is not None


def test_clean_html():
    raw = "<p>First paragraph.</p><br><script>alert(1);</script><div>Second &amp; final.</div>"
    cleaned = clean_html(raw)
    assert "First paragraph." in cleaned
    assert "Second & final." in cleaned
    assert "alert(1)" not in cleaned
    assert "<script>" not in cleaned


def test_intake_rss_deduplication(monkeypatch):
    # Mock feedparser with duplicate entries
    class MockEntry(dict):
        pass

    class MockFeed:
        entries = [
            MockEntry(title="Story A", link="https://site.com/a", summary="<p>Summary A</p>"),
            MockEntry(title="Story A Duplicate", link="https://site.com/a", summary="<p>Summary A dup</p>"),
            MockEntry(title="Story B", link="https://site.com/b", summary="<p>Summary B</p>"),
        ]

    import feedparser
    monkeypatch.setattr(feedparser, "parse", lambda url: MockFeed())

    items = intake_rss("https://feed.example.com/rss", limit=10)
    assert len(items) == 2  # Story A and Story B, duplicate filtered out
    assert items[0].id != items[1].id
    assert "entry_keys" in items[0].raw_story
