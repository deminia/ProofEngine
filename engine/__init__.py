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

__all__ = [
    "NicheConfig",
    "NichePack",
    "NichePrompts",
    "NicheValidationError",
    "load_niche",
    "render_prompt",
]
