"""ProofEngine Core Pipeline Package.

ProofEngine is a modular, niche-agnostic short-form video automation framework.
All niche-specific content is isolated within Niche Packs (`niches/<id>/`).
"""

from .niche_loader import (
    NicheConfig,
    NichePack,
    NichePrompts,
    NicheValidationError,
    load_niche,
    render_prompt,
)
from .screening import (
    ScreeningResult,
    screen_story,
    build_screening_prompt,
)
from .scripting import (
    ScriptResult,
    generate_script,
    adapt_to_global,
    build_script_prompt,
    estimate_duration_seconds,
)
from .llm import (
    complete as llm_complete,
    extract_json_object,
)

__all__ = [
    "NicheConfig",
    "NichePack",
    "NichePrompts",
    "NicheValidationError",
    "load_niche",
    "render_prompt",
    "ScreeningResult",
    "screen_story",
    "build_screening_prompt",
    "ScriptResult",
    "generate_script",
    "adapt_to_global",
    "build_script_prompt",
    "estimate_duration_seconds",
    "llm_complete",
    "extract_json_object",
]
