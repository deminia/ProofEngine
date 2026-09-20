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
    list_available_niches,
    sanitize_niche_config_for_ui,
    set_active_niche_override,
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
from .api import router as niche_api_router

__all__ = [
    "NicheConfig",
    "NichePack",
    "NichePrompts",
    "NicheValidationError",
    "load_niche",
    "render_prompt",
    "list_available_niches",
    "sanitize_niche_config_for_ui",
    "set_active_niche_override",
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
    "niche_api_router",
]
