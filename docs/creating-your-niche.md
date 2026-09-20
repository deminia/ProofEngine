# Creating Your Niche Pack (30-Minute Guide)

A **Niche Pack** defines all content-specific behavior for ProofEngine:
- What story topics to look for (Tiers & Categories)
- How AI scores incoming ideas (Screening Rubric)
- The narrative structure (Story Beats)
- Voice, pacing, and visual style (TTS & Visual Style)
- Social media captions, hashtags, and publishing schedule

All of this is done through configuration files—**zero Python code required**.

---

## 🚀 30-Minute Quickstart

### Step 1: Copy the Template (2 mins)
Copy the `niches/_template` directory and give it a unique kebab-case ID:
```bash
cp -r niches/_template niches/my-niche
```

Your new pack structure:
```
niches/my-niche/
├── niche.json                  # All configuration parameters
└── prompts/
    ├── screening.md            # AI story screening prompt
    ├── script_primary.md       # Primary language script prompt
    └── script_global.md        # Global English adaptation prompt
```

---

### Step 2: Configure `niche.json` (15 mins)

Open `niches/my-niche/niche.json` and customize the fields below.

#### Schema Field Reference

| Section | Field | Type | Required? | Description |
|---|---|---|---|---|
| **Identity** | `id` | string | ✅ Required | Unique kebab-case slug (e.g. `tech-failures`) |
| | `name` | string | ✅ Required | Display name (e.g. `Tech Startup Disasters`) |
| | `version` | string | Optional | Semver string (default `1.0.0`) |
| | `author` | string | Optional | Creator name or organization |
| | `description` | string | Optional | Brief overview of the content niche |
| **Languages** | `languages.primary` | object | ✅ Required | Main production language (`code`, `label`, `enabled`) |
| | `languages.global` | object | Optional | Global adaptation language (usually `en`) |
| **Discovery** | `discoveryTiers` | array | Optional | Content tiers and categories with keywords & examples |
| **Screening** | `screening.scoreRange` | `[min, max]` | ✅ Required | Numerical score bounds (e.g. `[0, 10]`) |
| | `screening.autoApproveThreshold` | float | ✅ Required | Minimum score to auto-queue (e.g. `7.0`) |
| | `screening.criteria` | array | ✅ Required | Weighted evaluation criteria (`id`, `weight`, `description`) |
| | `screening.hardRejectRules` | array | Optional | Blacklisted themes that trigger immediate rejection |
| **Story Beats** | `storyBeats` | array | ✅ Required | 4-6 narrative beats (`id`, `label`, `targetSeconds`, `description`) |
| **Voice / TTS** | `voice.provider` | string | ✅ Required | TTS engine (`edge-tts` default) |
| | `voice.primary` | object | ✅ Required | Primary voice settings (`voiceId`, `rate`, `pitch`) |
| | `voice.global` | object | Optional | Global voice settings |
| | `voice.overrides` | array | Optional | Tier-specific voice overrides (`matchTier`, `voiceId`) |
| **Visual** | `visual.footageProviders` | array | ✅ Required | Footage sources (e.g. `["pexels", "wikimedia"]`) |
| | `visual.aspectRatio` | string | Optional | Video ratio (`9:16` default for vertical short-form) |
| | `visual.durationSeconds` | `[min, max]` | ✅ Required | Target video duration range in seconds (e.g. `[45, 60]`) |
| **Social** | `social.hashtags` | object | ✅ Required | Hashtags per language (`primary`, `global`) |
| | `social.captionTemplates` | object | ✅ Required | Mustache templates for TikTok, YouTube, Facebook, etc. |
| | `social.factCheckDisclaimer` | string | Optional | Content disclaimer appended to descriptions |
| **Publishing**| `publishing.platforms` | array | ✅ Required | Enabled platforms (`["tiktok", "youtube", "instagram"]`) |
| | `publishing.defaultSchedule` | object | Optional | Posting times and timezone |

---

### Step 3: Customize Prompt Templates (10 mins)

Edit the Markdown files in `niches/my-niche/prompts/`. The engine automatically interpolates `{{variables}}` at runtime:

1. **`screening.md`**
   - Variables provided: `{{story}}`, `{{criteria}}`, `{{hardRejectRules}}`
   - Instructs the AI how to score candidate stories according to your niche rubric.
2. **`script_primary.md`**
   - Variables provided: `{{story}}`, `{{beats}}`, `{{duration}}`, `{{tone}}`
   - Defines spoken pacing, tone modifiers, and constraints (e.g., phonetic transliterations).
3. **`script_global.md`**
   - Variables provided: `{{script}}`, `{{culturalNotes}}`
   - Translates or adapts the script into punchy global English.

> 💡 **Fallback feature**: If your pack omits any prompt file, ProofEngine automatically falls back to `niches/_template/prompts/`.

---

### Step 4: Validate Your Niche Pack (3 mins)

Activate your pack in `engine.config.json`:
```json
{
  "activeNiche": "my-niche"
}
```
Or set the environment variable:
```bash
export NICHE=my-niche          # Linux/macOS
$env:NICHE="my-niche"          # Windows PowerShell
```

Run the automated validation suite:
```bash
python -m pytest tests/test_niche_loader.py -v
```

If your `niche.json` has missing fields or invalid ranges, the validator will output clear, human-readable error messages showing the exact field path.

---

## 🔒 Keeping Secret Sauce Private

If your niche pack contains proprietary prompts or proprietary keywords that should not be public:
1. Ensure the directory name is added to `.gitignore` (e.g. `niches/my-niche/` or `niches/private-*/`).
2. Keep public repositories configured with `example-finance` or `_template`.
