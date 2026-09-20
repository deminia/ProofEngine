"""Universal Story Ingestion Engine for ProofEngine.

Provides intake capabilities for RSS feeds, direct URLs, and manual input.
All ingested items calculate a deterministic URL/content hash for deduplication
and preserve the complete unadulterated raw payload for post-mortem debugging.
Zero niche-specific logic or terms.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import logging
import re
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, Field

from .niche_loader import NichePack, load_niche

log = logging.getLogger(__name__)


class IngestedStory(BaseModel):
    """Normalized ingested story entity ready for AI screening."""
    id: str = Field(..., description="Deterministic 16-character SHA-256 hash of URL or title")
    title: str = Field(..., min_length=1, description="Extracted headline or title")
    content: str = Field(default="", description="Story body, synopsis, or article text")
    source_url: Optional[str] = Field(default=None, description="Original source link")
    source_type: str = Field(default="manual", description="Intake source type: rss | url | manual")
    tier_id: Optional[str] = Field(default=None, description="Matched niche discovery tier ID")
    category_id: Optional[str] = Field(default=None, description="Matched niche category ID")
    raw_story: Dict[str, Any] = Field(default_factory=dict, description="Complete raw ingestion payload for debugging")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def compute_story_hash(source_url: Optional[str], title: str) -> str:
    """Generate a deterministic 16-char hex identifier from URL or title."""
    key = (source_url or "").strip().lower()
    if not key:
        key = title.strip().lower()
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]


def clean_html(raw_html: str) -> str:
    """Strip basic HTML markup into clean readable plaintext."""
    if not raw_html:
        return ""
    # Remove script and style elements
    text = re.sub(r"<(script|style)[^>]*>[\s\S]*?</\1>", " ", raw_html, flags=re.IGNORECASE)
    # Replace breaks and paragraphs with newlines
    text = re.sub(r"</?(p|br|div|li|h[1-6])[^>]*>", chr(10), text, flags=re.IGNORECASE)
    # Strip all other HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Unescape common entities
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    # Normalize excessive whitespace
    lines = [line.strip() for line in text.splitlines()]
    return chr(10).join(line for line in lines if line)


def match_niche_categories(
    text: str,
    pack: NichePack,
) -> tuple[Optional[str], Optional[str]]:
    """Match story text against active niche discovery tiers and categories."""
    lower_text = text.lower()
    for tier in pack.config.discoveryTiers:
        for cat in tier.categories:
            for kw in cat.keywords:
                if kw.lower() in lower_text:
                    return tier.id, cat.id
    return None, None


def intake_manual(
    title: str,
    content: str,
    source_url: Optional[str] = None,
    tier_id: Optional[str] = None,
    category_id: Optional[str] = None,
    extra_metadata: Optional[Dict[str, Any]] = None,
    pack: Optional[NichePack] = None,
) -> IngestedStory:
    """Create a structured story from manual user input."""
    clean_title = title.strip()
    clean_content = content.strip()
    story_hash = compute_story_hash(source_url, clean_title)

    raw_payload = {
        "title": clean_title,
        "content": clean_content,
        "source_url": source_url,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        **(extra_metadata or {}),
    }

    matched_tier = tier_id
    matched_cat = category_id
    if (not matched_tier or not matched_cat) and pack:
        auto_tier, auto_cat = match_niche_categories(f"{clean_title} {clean_content}", pack)
        matched_tier = matched_tier or auto_tier
        matched_cat = matched_cat or auto_cat

    return IngestedStory(
        id=story_hash,
        title=clean_title,
        content=clean_content,
        source_url=source_url,
        source_type="manual",
        tier_id=matched_tier,
        category_id=matched_cat,
        raw_story=raw_payload,
    )


def intake_url(
    url: str,
    timeout_seconds: float = 15.0,
    pack: Optional[NichePack] = None,
) -> IngestedStory:
    """Fetch article content directly from a URL, preserving raw response."""
    headers = {
        "User-Agent": "ProofEngine/1.0 (+https://proofengine.dev)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    with httpx.Client(timeout=timeout_seconds, follow_redirects=True) as client:
        resp = client.get(url, headers=headers)
        resp.raise_for_status()
        html = resp.text

    # Extract title
    title_match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
    extracted_title = title_match.group(1).strip() if title_match else urlparse(url).path.split("/")[-1]

    # Clean text content
    extracted_text = clean_html(html)

    raw_payload = {
        "url": url,
        "final_url": str(resp.url),
        "status_code": resp.status_code,
        "headers": dict(resp.headers),
        "html_preview": html[:3000],
        "extracted_title": extracted_title,
    }

    matched_tier, matched_cat = None, None
    if pack:
        matched_tier, matched_cat = match_niche_categories(f"{extracted_title} {extracted_text[:1000]}", pack)

    return IngestedStory(
        id=compute_story_hash(url, extracted_title),
        title=extracted_title,
        content=extracted_text[:10000],
        source_url=url,
        source_type="url",
        tier_id=matched_tier,
        category_id=matched_cat,
        raw_story=raw_payload,
    )


def intake_rss(
    feeds: List[str] | str,
    pack: Optional[NichePack] = None,
    seen_hashes: Optional[Set[str]] = None,
    limit: int = 20,
) -> List[IngestedStory]:
    """Parse RSS/Atom feeds, deduplicate with URL hash, and return normalized items.
    
    Preserves entry dictionary in raw_story for debugging.
    """
    import feedparser

    feed_list = [feeds] if isinstance(feeds, str) else list(feeds)
    seen = set(seen_hashes or set())
    ingested_items: List[IngestedStory] = []

    for feed_url in feed_list:
        try:
            parsed = feedparser.parse(feed_url)
            for entry in parsed.entries[:limit]:
                title = entry.get("title", "").strip()
                link = entry.get("link", "").strip()
                if not title and not link:
                    continue

                story_id = compute_story_hash(link, title)
                if story_id in seen:
                    continue

                summary = entry.get("summary", "") or entry.get("description", "")
                content_text = clean_html(summary)

                raw_payload = {
                    "feed_url": feed_url,
                    "id": story_id,
                    "entry_keys": list(entry.keys()),
                    "published": entry.get("published", ""),
                    "author": entry.get("author", ""),
                    "raw_summary": summary,
                    "tags": [t.get("term") for t in entry.get("tags", []) if isinstance(t, dict)],
                }

                matched_tier, matched_cat = None, None
                if pack:
                    matched_tier, matched_cat = match_niche_categories(f"{title} {content_text}", pack)

                story = IngestedStory(
                    id=story_id,
                    title=title,
                    content=content_text,
                    source_url=link or None,
                    source_type="rss",
                    tier_id=matched_tier,
                    category_id=matched_cat,
                    raw_story=raw_payload,
                )
                seen.add(story_id)
                ingested_items.append(story)

                if len(ingested_items) >= limit:
                    break
        except Exception as err:
            log.warning("Failed to parse RSS feed '%s': %s", feed_url, err)

        if len(ingested_items) >= limit:
            break

    return ingested_items
