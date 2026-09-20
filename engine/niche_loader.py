"""Niche loader and schema validator for ProofEngine (v1.1).

Loads and validates niche configuration packs from disk.
All niche packs must conform to the niche-1.1 JSON schema.
Zero niche-specific terminology is hardcoded in this module.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from pydantic import BaseModel, Field, field_validator, model_validator


class NicheValidationError(Exception):
    """Raised when a niche pack fails schema validation or is missing required files."""
    def __init__(self, message: str, errors: Optional[List[str]] = None):
        super().__init__(message)
        self.errors = errors or []


# ---------------------------------------------------------------------------
# Pydantic Schemas for niche.json (v1.1)
# ---------------------------------------------------------------------------

class LanguageItem(BaseModel):
    code: str = Field(..., min_length=2, max_length=10)
    label: str = Field(..., min_length=1)
    enabled: bool = True


class LanguagesConfig(BaseModel):
    primary: LanguageItem
    global_: Optional[LanguageItem] = Field(default=None, alias="global")

    model_config = {"populate_by_name": True}


class CategoryConfig(BaseModel):
    id: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)
    emoji: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)
    examples: List[str] = Field(default_factory=list)


class DiscoveryTier(BaseModel):
    id: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)
    emoji: Optional[str] = None
    priority: int = 1
    categories: List[CategoryConfig] = Field(default_factory=list)


class ScreeningCriterion(BaseModel):
    id: str = Field(..., min_length=1)
    weight: float = Field(..., ge=0.0, le=1.0)
    description: str = Field(..., min_length=1)


class ScreeningRubric(BaseModel):
    scoreRange: List[Union[int, float]] = Field(default_factory=lambda: [0, 10])
    autoApproveThreshold: float = Field(default=7.0)
    criteria: List[ScreeningCriterion] = Field(default_factory=list)
    hardRejectRules: List[str] = Field(default_factory=list)

    @field_validator("scoreRange")
    @classmethod
    def validate_score_range(cls, v: List[Union[int, float]]) -> List[Union[int, float]]:
        if len(v) != 2 or v[0] >= v[1]:
            raise ValueError(f"scoreRange must be a 2-element [min, max] list where min < max, got {v}")
        return v

    @model_validator(mode="after")
    def validate_threshold_within_range(self) -> ScreeningRubric:
        min_score, max_score = self.scoreRange
        if not (min_score <= self.autoApproveThreshold <= max_score):
            raise ValueError(
                f"autoApproveThreshold ({self.autoApproveThreshold}) must be within "
                f"scoreRange [{min_score}, {max_score}]"
            )
        return self


class StoryBeat(BaseModel):
    id: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)
    targetSeconds: List[Union[int, float]] = Field(..., min_length=2, max_length=2)
    description: Optional[str] = None

    @field_validator("targetSeconds")
    @classmethod
    def validate_target_seconds(cls, v: List[Union[int, float]]) -> List[Union[int, float]]:
        if v[0] >= v[1]:
            raise ValueError(f"targetSeconds [start, end] must have start < end, got {v}")
        return v


class VoiceSettings(BaseModel):
    voiceId: str = Field(..., min_length=1)
    rate: str = "+0%"
    pitch: str = "+0Hz"
    style: Optional[str] = None


class VoiceOverride(BaseModel):
    """v1.1: Override voice settings by matching tier and/or category ID."""
    matchTier: Optional[str] = None
    matchCategory: Optional[str] = None
    voiceId: str = Field(..., min_length=1)
    rate: str = "+0%"
    pitch: str = "+0Hz"
    style: Optional[str] = None


class VoiceConfig(BaseModel):
    provider: str = Field(default="edge-tts")
    primary: VoiceSettings
    global_: Optional[VoiceSettings] = Field(default=None, alias="global")
    overrides: List[VoiceOverride] = Field(default_factory=list)

    model_config = {"populate_by_name": True}

    def resolve_voice(
        self,
        tier_id: Optional[str] = None,
        category_id: Optional[str] = None,
        lang: str = "primary",
    ) -> VoiceSettings:
        """Resolve the effective voice settings based on category/tier overrides."""
        if lang == "global" and self.global_ is not None:
            base = self.global_
        else:
            base = self.primary

        # Check overrides in order of specificity (category first, then tier)
        for ov in self.overrides:
            if ov.matchCategory and category_id and ov.matchCategory.lower() == category_id.lower():
                return VoiceSettings(voiceId=ov.voiceId, rate=ov.rate, pitch=ov.pitch, style=ov.style)
        for ov in self.overrides:
            if ov.matchTier and tier_id and ov.matchTier.lower() == tier_id.lower():
                return VoiceSettings(voiceId=ov.voiceId, rate=ov.rate, pitch=ov.pitch, style=ov.style)

        return base


class CaptionStyle(BaseModel):
    font: str = "default"
    position: str = "bottom"
    highlightColor: str = "#facc15"


class VisualConfig(BaseModel):
    footageProviders: List[str] = Field(default_factory=lambda: ["pexels"])
    keywordLanguage: str = "en"
    captionStyle: CaptionStyle = Field(default_factory=CaptionStyle)
    aspectRatio: str = "9:16"
    resolution: str = "1080x1920"
    durationSeconds: List[int] = Field(default_factory=lambda: [45, 60])

    @field_validator("durationSeconds")
    @classmethod
    def validate_duration_range(cls, v: List[int]) -> List[int]:
        if len(v) != 2 or v[0] >= v[1]:
            raise ValueError(f"durationSeconds must be [min, max] with min < max, got {v}")
        return v


class SocialConfig(BaseModel):
    hashtags: Dict[str, List[str]] = Field(default_factory=dict)
    captionTemplates: Dict[str, str] = Field(default_factory=dict)
    affiliateLink: Optional[str] = None
    factCheckDisclaimer: Optional[str] = None


class PublishingSchedule(BaseModel):
    times: List[str] = Field(default_factory=lambda: ["12:00", "19:00"])
    timezone: str = "Asia/Bangkok"


class PublishingConfig(BaseModel):
    platforms: List[str] = Field(default_factory=lambda: ["tiktok", "youtube", "instagram"])
    defaultSchedule: Optional[PublishingSchedule] = None


class NicheConfig(BaseModel):
    """Complete root schema for niche.json (v1.1)."""
    id: str = Field(..., min_length=1, pattern=r"^[a-zA-Z0-9_-]+$")
    name: str = Field(..., min_length=1)
    version: str = Field(default="1.1.0")
    author: Optional[str] = None
    license: Optional[str] = None
    description: str = Field(default="")
    isPrivate: bool = Field(default=False, description="True if proprietary/secret sauce pack")
    languages: LanguagesConfig
    discoveryTiers: List[DiscoveryTier] = Field(default_factory=list)
    screening: ScreeningRubric
    storyBeats: List[StoryBeat] = Field(..., min_length=1)
    voice: VoiceConfig
    visual: VisualConfig
    social: SocialConfig
    publishing: PublishingConfig


class NichePrompts(BaseModel):
    """Loaded markdown prompt templates for a niche."""
    screening: str
    script_primary: str
    script_global: str


class NichePack(BaseModel):
    """A fully loaded and validated Niche Pack."""
    config: NicheConfig
    prompts: NichePrompts
    path: Path

    model_config = {"arbitrary_types_allowed": True}


# ---------------------------------------------------------------------------
# Loader Functions & State
# ---------------------------------------------------------------------------

_OVERRIDE_ACTIVE_NICHE: Optional[str] = None


def set_active_niche_override(niche_id: Optional[str]) -> None:
    """Dynamically set or clear the active niche in memory."""
    global _OVERRIDE_ACTIVE_NICHE
    _OVERRIDE_ACTIVE_NICHE = niche_id


def find_project_root(start_dir: Optional[Path] = None) -> Path:
    """Locate the ProofEngine root directory by checking for engine.config.json."""
    if start_dir:
        cur = start_dir.resolve()
    else:
        cur = Path(__file__).resolve().parent.parent
    for parent in [cur] + list(cur.parents):
        if (parent / "engine.config.json").exists():
            return parent
        if (parent / "niches").exists() and (parent / "engine").exists():
            return parent
    return cur


def get_active_niche_id(root_dir: Optional[Path] = None) -> str:
    """Determine the active niche ID from in-memory override -> NICHE env var -> engine.config.json."""
    if _OVERRIDE_ACTIVE_NICHE and _OVERRIDE_ACTIVE_NICHE.strip():
        return _OVERRIDE_ACTIVE_NICHE.strip()

    env_niche = os.environ.get("NICHE")
    if env_niche and env_niche.strip():
        return env_niche.strip()

    root = root_dir or find_project_root()
    config_file = root / "engine.config.json"
    if config_file.exists():
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                active = data.get("activeNiche")
                if active and isinstance(active, str) and active.strip():
                    return active.strip()
        except Exception:
            pass

    return "_template"


def _read_prompt_with_fallback(
    pack_dir: Path,
    template_dir: Path,
    filename: str,
) -> str:
    """Read a prompt file from pack_dir, falling back to template_dir."""
    target_file = pack_dir / "prompts" / filename
    if target_file.exists():
        return target_file.read_text(encoding="utf-8")

    fallback_file = template_dir / "prompts" / filename
    if fallback_file.exists():
        return fallback_file.read_text(encoding="utf-8")

    raise NicheValidationError(
        f"Prompt file '{filename}' not found in '{pack_dir}' or fallback '{template_dir}'"
    )


def load_niche(
    niche_id: Optional[str] = None,
    base_dir: Optional[Path] = None,
) -> NichePack:
    """Load, validate, and return a NichePack."""
    root = (base_dir or find_project_root()).resolve()
    target_id = niche_id or get_active_niche_id(root)

    niches_root = root / "niches"
    pack_dir = niches_root / target_id
    template_dir = niches_root / "_template"

    if not pack_dir.exists():
        raise NicheValidationError(
            f"Niche pack directory not found: {pack_dir} (resolved niche_id='{target_id}')"
        )

    json_file = pack_dir / "niche.json"
    if not json_file.exists():
        raise NicheValidationError(
            f"Missing niche.json in niche pack directory: {pack_dir}"
        )

    try:
        raw_text = json_file.read_text(encoding="utf-8")
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        raise NicheValidationError(
            f"Malformed JSON in {json_file}: {e}"
        ) from e
    except Exception as e:
        raise NicheValidationError(
            f"Failed to read {json_file}: {e}"
        ) from e

    # Detect private pack conventions if isPrivate is not explicitly set
    if "isPrivate" not in data:
        if target_id.startswith("private-") or target_id.endswith("-private") :
            data["isPrivate"] = True

    try:
        config = NicheConfig.model_validate(data)
    except Exception as e:
        errors = []
        if hasattr(e, "errors"):
            for err in e.errors():
                loc = " -> ".join(str(x) for x in err.get("loc", []))
                msg = err.get("msg", "invalid")
                errors.append(f"Field '{loc}': {msg}")
        else:
            errors.append(str(e))
        raise NicheValidationError(
            f"Validation failed for niche pack '{target_id}':\n" + "\n".join(f"  - {err}" for err in errors),
            errors=errors,
        ) from e

    # Load prompts with fallback to _template
    screening_prompt = _read_prompt_with_fallback(pack_dir, template_dir, "screening.md")
    script_primary_prompt = _read_prompt_with_fallback(pack_dir, template_dir, "script_primary.md")
    script_global_prompt = _read_prompt_with_fallback(pack_dir, template_dir, "script_global.md")

    prompts = NichePrompts(
        screening=screening_prompt,
        script_primary=script_primary_prompt,
        script_global=script_global_prompt,
    )

    return NichePack(
        config=config,
        prompts=prompts,
        path=pack_dir,
    )


def list_available_niches(base_dir: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Scan the niches/ directory and list available packs with metadata."""
    root = (base_dir or find_project_root()).resolve()
    niches_root = root / "niches"
    active_id = get_active_niche_id(root)
    results = []

    if not niches_root.exists():
        return results

    for item in sorted(niches_root.iterdir()):
        if item.is_dir() and (item / "niche.json").exists():
            try:
                data = json.loads((item / "niche.json").read_text(encoding="utf-8"))
                nid = data.get("id", item.name)
                is_priv = bool(
                    data.get("isPrivate")
                    or nid.startswith("private-")
                    or nid.endswith("-private")
                    
                )
                results.append({
                    "id": nid,
                    "name": data.get("name", nid),
                    "version": data.get("version", "1.0.0"),
                    "description": data.get("description", ""),
                    "isPrivate": is_priv,
                    "isActive": (nid == active_id),
                })
            except Exception:
                pass

    return results


def sanitize_niche_config_for_ui(config: NicheConfig) -> Dict[str, Any]:
    """Strip secret keywords/internal examples if pack is private for secure UI consumption."""
    raw = config.model_dump(by_alias=True)

    # If pack is private, sanitize discovery tiers (remove secret keyword and example collections)
    if config.isPrivate:
        sanitized_tiers = []
        for t in raw.get("discoveryTiers", []):
            st = dict(t)
            st_cats = []
            for c in t.get("categories", []):
                sc = dict(c)
                sc["keywords"] = []  # sanitized
                sc["examples"] = []  # sanitized
                st_cats.append(sc)
            st["categories"] = st_cats
            sanitized_tiers.append(st)
        raw["discoveryTiers"] = sanitized_tiers

    return raw


def render_prompt(template_str: str, variables: Dict[str, Any]) -> str:
    """Render a prompt template containing {{variable}} placeholders safely.
    
    Uses exact string replacement to prevent regex backreference injection.
    """
    res = template_str
    for key, val in variables.items():
        if isinstance(val, (dict, list)):
            if isinstance(val, list) and all(isinstance(x, str) for x in val):
                val_str = "\n".join(f"- {x}" for x in val)
            else:
                val_str = json.dumps(val, ensure_ascii=False, indent=2)
        else:
            val_str = str(val) if val is not None else ""
        
        # Exact placeholder match without regex escape vulnerability
        placeholder = "{{" + key + "}}"
        if placeholder in res:
            res = res.replace(placeholder, val_str)
        else:
            pattern = re.compile(r"\{\{\s*" + re.escape(key) + r"\s*\}\}")
            res = pattern.sub(lambda _: val_str, res)
            
    return res
