"""Script Generation and Adaptation Module for ProofEngine.

Generates structured viral scripts by iterating `storyBeats` dynamically
from the active Niche Pack, binding resolved voice settings, and adapting
to global languages. Zero hardcoded beat names or niche terms.
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List, Optional, Union
from pydantic import BaseModel, Field

from .llm import complete as default_llm_complete, extract_json_object
from .niche_loader import NichePack, StoryBeat, VoiceSettings, load_niche, render_prompt

log = logging.getLogger(__name__)


class ScriptResult(BaseModel):
    """Structured result of a generated short-form video script."""
    title: str = Field(..., description="Post title")
    body: str = Field(..., description="Full spoken narration script with beat pauses")
    body_global: Optional[str] = Field(default=None, description="Adapted global language narration")
    hook_score: float = Field(default=0.0, description="Self-scored hook effectiveness")
    hook_reason: str = Field(default="", description="Rationale for the hook score")
    hashtags: str = Field(default="", description="Recommended hashtags string")
    description: str = Field(default="", description="Post caption/description with attribution")
    visual_keywords: List[str] = Field(default_factory=list, description="Timeline stock footage search keywords")
    hook_variants: List[str] = Field(default_factory=list, description="Alternative hooks for A/B testing")
    beats: List[StoryBeat] = Field(default_factory=list, description="Active story beats applied")
    voice_settings: VoiceSettings = Field(..., description="Resolved TTS voice configuration")
    target_duration: int = Field(..., description="Target duration in seconds")
    estimated_duration: float = Field(..., description="Calculated duration from word count")


def estimate_duration_seconds(body_text: str, words_per_second: float = 3.2) -> float:
    """Estimate spoken audio duration based on language and word count."""
    words = len(body_text.split())
    if words == 0:
        return 0.0
    return round(words / words_per_second, 1)


def build_script_prompt(
    story_text: str,
    pack: NichePack,
    duration: int,
    tone: Optional[str] = None,
) -> str:
    """Construct the scriptwriting prompt from dynamic story beats."""
    beats_lines = []
    for b in pack.config.storyBeats:
        desc = f" — {b.description}" if b.description else ""
        beats_lines.append(f"[{b.id.upper()} ({b.targetSeconds[0]}-{b.targetSeconds[1]}s): {b.label}]{desc}")
    beats_str = "\n".join(beats_lines)

    tone_str = tone or pack.config.description or "(Use authentic conversational storytelling with high emotional stakes)"

    variables = {
        "story": story_text,
        "beats": beats_str,
        "duration": str(duration),
        "tone": tone_str,
    }

    return render_prompt(pack.prompts.script_primary, variables)


def generate_script(
    title: str,
    content: str,
    pack: Optional[NichePack] = None,
    tier_id: Optional[str] = None,
    category_id: Optional[str] = None,
    tone: Optional[str] = None,
    target_duration: Optional[int] = None,
    llm_complete: Optional[Callable[[str], str]] = None,
) -> ScriptResult:
    """Generate a viral short-form script using dynamic beats from the active niche pack.
    
    Args:
        title: Story title/hook idea.
        content: Researched story facts or background.
        pack: NichePack instance. Defaults to active niche.
        tier_id: Optional discovery tier ID for voice resolution.
        category_id: Optional category ID for voice resolution.
        tone: Optional tone guidance override.
        target_duration: Target duration in seconds. Defaults to mid of visual.durationSeconds.
        llm_complete: Optional LLM completion callable.
    """
    niche = pack or load_niche()
    
    # 1. Resolve duration
    dur_range = niche.config.visual.durationSeconds
    dur = target_duration or int((dur_range[0] + dur_range[1]) / 2)

    # 2. Resolve voice settings
    voice_settings = niche.config.voice.resolve_voice(tier_id=tier_id, category_id=category_id, lang="primary")

    # 3. Build prompt and complete
    story_combined = f"Title: {title}\nContent: {content}".strip()
    prompt = build_script_prompt(story_combined, niche, duration=dur, tone=tone)

    complete_fn = llm_complete or (lambda p: default_llm_complete(p, task="script"))
    raw_output = complete_fn(prompt)
    data = extract_json_object(raw_output)

    if not data:
        log.warning("Script generation response could not be parsed as JSON: %s", raw_output)
        data = {
            "title": title,
            "body": raw_output.strip(),
            "hook_score": 5.0,
            "hook_reason": "Model returned raw text",
            "hashtags": "",
            "description": "",
            "visual_keywords": [],
            "hook_variants": [],
        }

    body = str(data.get("body", "")).strip()
    out_title = str(data.get("title", title)).strip()
    hook_score = float(data.get("hook_score", 7.0))
    hook_reason = str(data.get("hook_reason", "")).strip()
    hashtags = str(data.get("hashtags", "")).strip()
    description = str(data.get("description", "")).strip()
    keywords = [str(k).strip() for k in data.get("visual_keywords", []) if str(k).strip()]
    variants = [str(v).strip() for v in data.get("hook_variants", []) if str(v).strip()]

    estimated_sec = estimate_duration_seconds(body)

    return ScriptResult(
        title=out_title,
        body=body,
        body_global=None,
        hook_score=hook_score,
        hook_reason=hook_reason,
        hashtags=hashtags,
        description=description,
        visual_keywords=keywords,
        hook_variants=variants,
        beats=niche.config.storyBeats,
        voice_settings=voice_settings,
        target_duration=dur,
        estimated_duration=estimated_sec,
    )


def adapt_to_global(
    script_body: str,
    pack: Optional[NichePack] = None,
    cultural_notes: str = "",
    llm_complete: Optional[Callable[[str], str]] = None,
) -> str:
    """Adapt primary script into global language using prompts.script_global."""
    niche = pack or load_niche()
    variables = {
        "script": script_body,
        "culturalNotes": cultural_notes or "(Maintain documentary realism and pacing)",
    }
    prompt = render_prompt(niche.prompts.script_global, variables)
    complete_fn = llm_complete or (lambda p: default_llm_complete(p, task="script"))
    adapted = complete_fn(prompt).strip()
    
    # Clean possible markdown quotes/fences
    for fence in ('"""', "```"):
        if adapted.startswith(fence) and adapted.endswith(fence):
            adapted = adapted[len(fence):-len(fence)].strip()
    return adapted
