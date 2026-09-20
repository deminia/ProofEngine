# ProofEngine

A modular, niche-agnostic short-form video automation framework.

ProofEngine decouples video production infrastructure (story intake → AI screening → scriptwriting → TTS → FFmpeg assembly → multi-platform publishing → analytics) from content themes. All niche-specific logic, prompts, story beats, voice settings, and metadata live in **Niche Packs** under `niches/`.

## Architecture

- `engine/`: Core execution pipeline. Guaranteed zero hardcoded niche terms.
- `niches/`: Data-driven niche packs.
  - `_template/`: Base template for creating new niches.
  - `example-finance/`: Worked example pack for personal finance & wealth building.
  - `karma-th/`: Production pack for justice and karma documentaries.
- `dashboard/`: React management UI rendered dynamically from the active niche pack.
- `engine.config.json`: Global runtime settings and active niche selection.

## Getting Started

### 1. Requirements
- Python 3.11+
- FFmpeg (for video assembly)

### 2. Verify Niche Loader
```bash
python -m pytest tests/test_niche_loader.py -v
```

### 3. Active Niche Selection
Set via `engine.config.json`:
```json
{
  "activeNiche": "example-finance"
}
```
Or via environment variable:
```bash
export NICHE=example-finance  # Linux / macOS
$env:NICHE="example-finance"   # Windows PowerShell
```

## License

PolyForm Noncommercial License 1.0.0 — Copyright (c) 2026 Ranchaseth Jiraphimkun.
Commercial licenses available upon request.
