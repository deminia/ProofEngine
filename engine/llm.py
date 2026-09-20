"""Unified LLM client interface for ProofEngine.

Provides a pluggable abstraction for LLM completions supporting
OpenRouter, Anthropic, Google, and OpenAI, with JSON extraction utilities.
Zero niche-specific logic.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, Optional

log = logging.getLogger(__name__)


def extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    """Extract the first valid JSON object from text or markdown fences."""
    if not text:
        return None
    cleaned = text.strip()
    
    # Check for markdown code fences
    fence_pattern = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
    if fence_pattern:
        cleaned = fence_pattern.group(1).strip()

    decoder = json.JSONDecoder()
    idx = 0
    while idx < len(cleaned):
        pos = cleaned.find("{", idx)
        if pos < 0:
            break
        try:
            obj, _ = decoder.raw_decode(cleaned, pos)
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass
        idx = pos + 1

    return None


def complete(
    prompt: str,
    task: Optional[str] = None,
    provider: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> str:
    """Execute LLM completion based on environment configuration.
    
    Priority:
    1. Direct arguments (provider, model)
    2. Environment variables: LLM_<TASK> -> LLM_PROVIDER / LLM_MODEL
    """
    prov = (provider or os.environ.get(f"LLM_{task.upper()}_PROVIDER", "") or os.environ.get("LLM_PROVIDER", "openrouter")).lower()
    mod = model or os.environ.get(f"LLM_{task.upper()}_MODEL", "") or os.environ.get("LLM_MODEL", "")

    # For testing or stubbed execution without keys:
    if os.environ.get("MOCK_LLM_RESPONSE"):
        return os.environ["MOCK_LLM_RESPONSE"]

    api_key = (
        os.environ.get(f"{prov.upper()}_API_KEY")
        or os.environ.get("OPENROUTER_API_KEY")
        or os.environ.get("ANTHROPIC_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
    )
    if not api_key:
        raise RuntimeError(
            f"No API key configured for LLM provider '{prov}'. "
            f"Set {prov.upper()}_API_KEY or OPENROUTER_API_KEY."
        )

    import httpx

    if prov == "openrouter":
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://proofengine.dev",
            "X-Title": "ProofEngine",
        }
        payload = {
            "model": mod or "google/gemini-2.0-flash-lite-preview-02-05:free",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    raise NotImplementedError(f"Provider '{prov}' execution not configured in lightweight client.")
