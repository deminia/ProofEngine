"""ProofEngine API Routes for Niche Configuration & Dashboard Wiring.

Provides sanitized endpoints for the React dashboard:
- GET /api/niche/active: Return sanitized config (safe for browser DevTools)
- POST /api/niche/switch: Switch active niche pack
- GET /api/niche/list: List available packs
Zero niche-specific logic.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from .niche_loader import (
    NicheValidationError,
    get_active_niche_id,
    list_available_niches,
    load_niche,
    sanitize_niche_config_for_ui,
    set_active_niche_override,
)

log = logging.getLogger(__name__)

try:
    from fastapi import APIRouter, HTTPException
except ImportError:
    # Minimal stub router for environments without fastapi installed
    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    class APIRouter:
        def __init__(self, *args, **kwargs):
            self.routes = []
        def get(self, path, *args, **kwargs):
            def decorator(f):
                return f
            return decorator
        def post(self, path, *args, **kwargs):
            def decorator(f):
                return f
            return decorator

router = APIRouter(prefix="/api/niche", tags=["niche"])


class SwitchNicheRequest(BaseModel):
    nicheId: str = Field(..., min_length=1)


@router.get("/active")
def get_active_niche() -> Dict[str, Any]:
    """Return the active niche pack configuration, sanitized for frontend UI consumption.
    
    Secret sauce (internal prompts and private category keywords/examples)
    is stripped if the pack has isPrivate=True.
    """
    try:
        pack = load_niche()
    except NicheValidationError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return sanitize_niche_config_for_ui(pack.config)


@router.get("/list")
def list_niches() -> List[Dict[str, Any]]:
    """List all available niche packs on disk with metadata."""
    return list_available_niches()


@router.post("/switch")
def switch_active_niche(req: SwitchNicheRequest) -> Dict[str, Any]:
    """Switch the active niche pack after validating that it exists and conforms to schema."""
    target_id = req.nicheId.strip()
    try:
        pack = load_niche(target_id)
    except NicheValidationError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot switch to niche '{target_id}': {e}",
        )

    set_active_niche_override(target_id)
    log.info("Active niche switched to: %s", target_id)
    return {
        "ok": True,
        "activeNiche": target_id,
        "name": pack.config.name,
        "isPrivate": pack.config.isPrivate,
    }
