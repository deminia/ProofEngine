# ProofEngine — Niche Configuration Spec (v1.1)

> **Goal:** Hard-fork ProofKarma into a niche-agnostic short-form video automation framework.
> The engine (ingestion → AI screening → scriptwriting → TTS → FFmpeg assembly → multi-platform publishing → analytics) must contain ZERO hardcoded niche content. All niche-specific behavior is driven by a **Niche Pack** (config file + prompt templates).
> License: PolyForm Noncommercial 1.0.0 — Copyright (c) 2026 Ranchaseth Jiraphimkun.

---

## 1. Repository Structure

```
ProofEngine/
├── engine/                  # Core pipeline (no niche words allowed)
│   ├── ingestion/           # RSS / URL / manual / AI finder intake
│   ├── screening/           # AI scoring & filtering
│   ├── scripting/           # TH/EN (or any-language) script generation
│   ├── voice/               # TTS abstraction (Edge-TTS default)
│   ├── assembly/            # FFmpeg render pipeline
│   ├── publishing/          # Platform adapters (TikTok, YT, IG, FB, Shopee, X)
│   └── analytics/           # Metrics ingestion & dashboards
├── niches/                  # Niche Packs (data, not code)
│   ├── _template/           # Template pack — copy this to create a new niche
│   │   ├── niche.json
│   │   └── prompts/
│   │       ├── screening.md
│   │       ├── script_primary.md
│   │       └── script_global.md
│   └── example-finance/     # One complete worked example
├── dashboard/               # React dashboard — renders everything from active niche config
├── engine.config.json       # Global engine settings (paths, API keys refs, platforms)
├── LICENSE                  # PolyForm Noncommercial 1.0.0
└── README.md
```

**Hard rule:** any string mentioning a specific topic (e.g. karma, ghost, finance) must live inside a niche pack, never in `engine/` or `dashboard/`.

---

## 2. `niche.json` Schema

```jsonc
{
  "$schema": "https://proofengine.dev/schemas/niche-1.0.json",

  // ---- Identity ----
  "id": "karma-th",                    // slug, unique, kebab-case
  "name": "Karma & Justice Stories",   // display name
  "version": "1.0.0",
  "author": "Ranchaseth Jiraphimkun",
  "description": "Social-drama karma & supernatural revenge stories",

  // ---- Language / Pipelines ----
  "languages": {
    "primary": { "code": "th", "label": "ไทย", "enabled": true },
    "global":  { "code": "en", "label": "English (Global)", "enabled": true }
  },

  // ---- Discovery Tiers (replaces hardcoded TIER S/S+/A/B/G) ----
  "discoveryTiers": [
    {
      "id": "s",
      "label": "TIER S — Double Down",
      "emoji": "🥇",
      "priority": 1,
      "categories": [
        { "id": "corporate-fraud", "label": "องค์กรฉ้อฉล", "emoji": "🏢",
          "keywords": ["pharma scandal", "product cover-up", "food poisoning cover up"],
          "examples": ["Enron", "Lehman", "Theranos"] }
      ]
    }
    // ...more tiers
  ],

  // ---- AI Screening Rubric ----
  "screening": {
    "scoreRange": [0, 10],
    "autoApproveThreshold": 7.0,       // dashboard default filter
    "criteria": [
      { "id": "emotional-hook", "weight": 0.3, "description": "Strong emotional trigger in first 3 seconds" },
      { "id": "retention",      "weight": 0.3, "description": "Story arc sustains 45-60s" },
      { "id": "brand-safe",     "weight": 0.2, "description": "No gore/hate; monetization-safe" },
      { "id": "rpm-potential",  "weight": 0.2, "description": "Advertiser-friendly category" }
    ],
    "hardRejectRules": ["graphic violence", "hate speech", "minors in distress"]
  },

  // ---- Script Structure (Story Beats) ----
  "storyBeats": [
    { "id": "hook",         "label": "HOOK",          "targetSeconds": [0, 3] },
    { "id": "setup",        "label": "SETUP",         "targetSeconds": [3, 12] },
    { "id": "villain",      "label": "VILLAIN",       "targetSeconds": [12, 25] },
    { "id": "turning-point","label": "TURNING POINT", "targetSeconds": [25, 40] },
    { "id": "payoff",       "label": "PAYOFF",        "targetSeconds": [40, 52] },
    { "id": "cta",          "label": "CTA",           "targetSeconds": [52, 60] }
  ],

  // ---- Voice / TTS (v1.1: with tier/category overrides) ----
  "voice": {
    "provider": "edge-tts",
    "primary": { "voiceId": "th-TH-PremwadeeNeural", "rate": "+0%", "style": null },
    "global":  { "voiceId": "en-US-ChristopherNeural", "rate": "+2%", "style": null },
    "overrides": [
      { "matchTier": "g", "voiceId": "th-TH-AdisornNeural", "rate": "+0%", "pitch": "+0Hz", "style": null }
    ]
  },

  // ---- Visual Style ----
  "visual": {
    "footageProviders": ["pexels", "wikimedia", "local_upload"],
    "keywordLanguage": "en",               // footage search keyword language
    "captionStyle": { "font": "default", "position": "bottom", "highlightColor": "#facc15" },
    "aspectRatio": "9:16",
    "resolution": "1080x1920",
    "durationSeconds": [45, 60]
  },

  // ---- Social Metadata ----
  "social": {
    "hashtags": {
      "primary": ["#กฎแห่งกรรม", "#karma"],
      "global":  ["#karma", "#justice"]
    },
    "captionTemplates": {
      "tiktok":   "{{title}} {{hashtags}}",
      "youtube":  "{{title}}\n\n{{description}}\n\n{{hashtags}}",
      "facebook": "{{title}}\n{{description}}",
      "x_thread": "{{title}} (1/5)"
    },
    "affiliateLink": null,                 // optional URL injected into descriptions
    "factCheckDisclaimer": "Content retold from public sources; verify independently."
  },

  // ---- Publishing Defaults ----
  "publishing": {
    "platforms": ["tiktok", "youtube", "instagram", "facebook", "shopee", "x"],
    "defaultSchedule": { "times": ["12:00", "19:00"], "timezone": "Asia/Bangkok" }
  }
}
```

---

## 3. Prompt Templates

Each niche pack contains Markdown prompt templates with `{{variables}}` injected by the engine:

| Template | Purpose | Required variables |
|---|---|---|
| `prompts/screening.md` | Score incoming story ideas | `{{story}}`, `{{criteria}}`, `{{hardRejectRules}}` |
| `prompts/script_primary.md` | Write script in primary language | `{{story}}`, `{{beats}}`, `{{duration}}`, `{{tone}}` |
| `prompts/script_global.md` | Adapt (not translate) for global audience | `{{script}}`, `{{culturalNotes}}` |

Engine provides fallback generic templates if a pack omits any file.

---

## 4. Engine Changes Required

1. **Niche loader** (`engine/nicheLoader.js`): validates `niche.json` against JSON Schema, merges with `_template` defaults, throws on missing required fields. Active niche selected via `engine.config.json → activeNiche` or `NICHE` env var.
2. **Screening module**: builds prompt from `screening.criteria` + weights; returns score + per-criterion breakdown.
3. **Scripting module**: iterates `storyBeats` array instead of hardcoded beat names.
4. **Voice module**: reads `voice` block; keeps Edge-TTS as default provider behind a `TTSProvider` interface so others (ElevenLabs etc.) can be added later.
5. **Publishing module**: unchanged logic; platform list + caption templates come from `social`/`publishing` blocks.
6. **Database**: rename any niche-specific columns/enums to generic ones (`tier`, `category_id` referencing niche config ids).

---

## 5. Dashboard Changes Required

1. **Queue page — AI Finder section**: render tier tabs and category chips **entirely from `discoveryTiers`** (neutral chip styling as previously established). No hardcoded tier names.
2. **Scripts page — Footage & Story Beats tab**: render beats from `storyBeats` array (id, label, target seconds).
3. **Videos page**: platform chips from `publishing.platforms`; caption copy menu from `social.captionTemplates` keys.
4. **Settings page — new "Niche" section**: dropdown to switch active niche pack, "Import niche pack (.zip)" button, and link to `niches/_template`.
5. Word-count/duration estimator uses `visual.durationSeconds` for the target range.

---

## 6. Migration Plan (ProofKarma → ProofEngine)

1. Create `niches/karma-th/niche.json` + prompts from current hardcoded content (extract, don't rewrite — this validates the schema against the real workload).
2. Create `niches/example-finance/` as the public demo pack (safe, generic).
3. Refactor engine + dashboard per §4–5 until ProofKarma runs **unchanged** on the karma-th pack.
4. Delete all niche strings from engine/dashboard (grep check in CI: `grep -riE "karma|ghost|theranos" engine/ dashboard/src/` must return 0 matches).
5. Public repo = engine + `_template` + `example-finance`. Private repo keeps `karma-th` pack.

---

## 7. Acceptance Criteria

- [ ] `niches/_template` passes schema validation and runs end-to-end with a dummy story.
- [ ] Switching `activeNiche` between two packs changes tiers, prompts, voice, hashtags — zero code edits.
- [ ] CI grep check: no niche-specific strings in `engine/` or `dashboard/src/`.
- [ ] All existing 20 dashboard tests pass + new tests for `nicheLoader` (valid pack, missing field, bad threshold type).
- [ ] `docs/creating-your-niche.md` lets a new user ship a custom niche in ≤30 min using only the template pack.
