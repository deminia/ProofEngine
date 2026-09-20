"""AI Story Screening Engine for ProofEngine.

Evaluates raw incoming story concepts against the active Niche Pack's
weighted criteria, score range, auto-approve threshold, and hard reject rules.
Zero niche-specific terms hardcoded.
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List, Optional
from pydantic import BaseModel, Field

from .llm import complete as default_llm_complete, extract_json_object
from .niche_loader import NichePack, load_niche, render_prompt

log = logging.getLogger(__name__)


class ScreeningResult(BaseModel):
    """Structured evaluation output from the screening engine."""
    score: float = Field(..., description="Overall viral/appeal score within the niche scoreRange")
    passed: bool = Field(..., description="True if score >= autoApproveThreshold")
    hook: str = Field(default="", description="Key emotional hook or angle surfaced by AI")
    reason: str = Field(default="", description="Summary justification for the assigned score")
    copyright_risk: str = Field(default="low", description="Evaluated risk: low, medium, or high")
    copyright_note: Optional[str] = Field(default=None, description="Feasibility or source notes")
    criteria_breakdown: Dict[str, float] = Field(default_factory=dict, description="Per-criterion scores")
    raw_response: Optional[str] = Field(default=None, description="Raw model response text")


def build_screening_prompt(
    story_text: str,
    pack: NichePack,
) -> str:
    """Construct the formatted screening prompt using the niche pack."""
    rubric = pack.config.screening

    # 1. Format criteria with IDs, weights, and descriptions
    criteria_lines = []
    for c in rubric.criteria:
        criteria_lines.append(f"- [{c.id}] (Weight: {c.weight * 100:.0f}%): {c.description}")
    criteria_str = "\n".join(criteria_lines)

    # 2. Format hard reject rules
    rules_lines = [f"- {r}" for r in rubric.hardRejectRules]
    rules_str = "\n".join(rules_lines) if rules_lines else "(None specified)"

    variables = {
        "story": story_text,
        "criteria": criteria_str,
        "hardRejectRules": rules_str,
        "scoreRange": f"[{rubric.scoreRange[0]}, {rubric.scoreRange[1]}]",
        "autoApproveThreshold": str(rubric.autoApproveThreshold),
    }

    return render_prompt(pack.prompts.screening, variables)


def screen_story(
    title: str,
    content: str,
    pack: Optional[NichePack] = None,
    llm_complete: Optional[Callable[[str], str]] = None,
) -> ScreeningResult:
    """Screen an incoming story idea against the active niche rubric.
    
    Args:
        title: Story headline or title.
        content: Full text, summary, or reference details.
        pack: NichePack instance. If None, loads active niche automatically.
        llm_complete: Optional LLM completion callable for testing/mocking.
    
    Returns:
        ScreeningResult instance.
    """
    niche = pack or load_niche()
    story_combined = f"TITLE: {title}\nCONTENT: {content}".strip()
    prompt = build_screening_prompt(story_combined, niche)

    complete_fn = llm_complete or (lambda p: default_llm_complete(p, task="screener"))
    raw_output = complete_fn(prompt)
    data = extract_json_object(raw_output)

    if not data:
        log.warning("Screening response could not be parsed as JSON: %s", raw_output)
        return ScreeningResult(
            score=0.0,
            passed=False,
            hook="",
            reason="Model failed to return valid JSON",
            copyright_risk="high",
            copyright_note="Unparseable AI response",
            raw_response=raw_output,
        )

    score = float(data.get("score", 0.0))
    min_score, max_score = niche.config.screening.scoreRange
    score = max(min_score, min(max_score, score))

    threshold = niche.config.screening.autoApproveThreshold
    passed = score >= threshold

    hook = str(data.get("hook", "")).strip()
    reason = str(data.get("reason", "")).strip()
    risk = str(data.get("copyright_risk", "low")).lower().strip()
    if risk not in ("low", "medium", "high"):
        risk = "medium"
    note = data.get("copyright_note")
    breakdown = data.get("criteria_breakdown", {})
    if isinstance(breakdown, dict):
        clean_breakdown = {str(k): float(v) for k, v in breakdown.items() if isinstance(v, (int, float))}
    else:
        clean_breakdown = {}

    return ScreeningResult(
        score=score,
        passed=passed,
        hook=hook,
        reason=reason,
        copyright_risk=risk,
        copyright_note=str(note).strip() if note else None,
        criteria_breakdown=clean_breakdown,
        raw_response=raw_output,
    )
