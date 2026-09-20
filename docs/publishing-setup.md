# Multi-Platform Publishing Setup Guide

ProofEngine includes a modular publishing engine ([`engine/publishing.py`](../engine/publishing.py)) that dispatches finished 9:16 vertical videos to major short-form video platforms.

---

## 🛡️ Core Principle: Dry-Run by Default

All publishing adapters execute in **Dry-Run mode by default** (`dry_run=True`):
- **Zero API keys required for testing:** ProofEngine builds, formats, and validates the exact payload required by each platform's official API without making external network calls.
- **Pre-flight payload inspection:** Developers can inspect title truncation, caption template rendering, hashtag extraction, and video file integrity before dispatching.
- **Live distribution:** To perform real live network uploads, operators must explicitly pass `dry_run=False` and supply valid platform developer credentials via environment variables.

---

## 📋 Platform Setup & API Credentials

To enable live publishing (`dry_run=False`), create developer accounts and configure the environment variables in your `.env` file:

### 1. YouTube Shorts
- **API**: YouTube Data API v3
- **Portal**: [Google Cloud Console](https://console.cloud.google.com/)
- **Setup**:
  1. Create a project and enable the **YouTube Data API v3**.
  2. Configure the OAuth Consent Screen (Internal or External).
  3. Create an **OAuth 2.0 Client ID** (Application type: *Desktop App*).
  4. Download the JSON credential file and save it locally (e.g. `credentials/client_secret.json`).
  5. Required Scope: `https://www.googleapis.com/auth/youtube.upload`.
- **Environment Variables**:
  ```bash
  YOUTUBE_CLIENT_SECRET_FILE=credentials/client_secret.json
  YOUTUBE_TOKEN_FILE=credentials/token.json
  YOUTUBE_PRIVACY=public     # public | unlisted | private
  YOUTUBE_CATEGORY=24        # 24 = Entertainment, 27 = Education
  ```

---

### 2. TikTok
- **API**: Content Posting API v2
- **Portal**: [TikTok for Developers](https://developers.tiktok.com/)
- **Setup**:
  1. Register as a TikTok Developer and create an App.
  2. Add the **Content Posting API** product.
  3. Submit the app for TikTok review (required for production access).
  4. Obtain the user access token with permissions `video.upload` and `video.publish`.
- **Environment Variables**:
  ```bash
  TIKTOK_ACCESS_TOKEN=act.xxxxxxxxxxxxxxxx
  TIKTOK_CREATOR_ID=
  ```

---

### 3. Instagram Reels & Facebook Video
- **API**: Meta Graph API (Instagram Graph API + Facebook Pages API)
- **Portal**: [Meta for Developers](https://developers.facebook.com/)
- **Setup**:
  1. Create a **Business App** in the Meta Developer Portal.
  2. Connect your Instagram Professional / Creator account to your Facebook Page.
  3. Generate a long-lived Page / System User Access Token with the following permissions:
     - `instagram_content_publish`
     - `instagram_basic`
     - `pages_manage_posts`
     - `pages_read_engagement`
  4. Note: Instagram Reels container upload requires a public HTTPS URL (e.g. from Cloudflare R2).
- **Environment Variables**:
  ```bash
  META_ACCESS_TOKEN=EAAGxxxxxxxxxxxxxxxx
  META_IG_USER_ID=17841400000000000
  META_PAGE_ID=100000000000000
  ```

---

### 4. X (Twitter)
- **API**: X Media Upload v1.1 + Tweets API v2
- **Portal**: [X Developer Portal](https://developer.x.com/)
- **Setup**:
  1. Create a Project and Developer App.
  2. Under User authentication settings, enable **OAuth 1.0a** with **Read and Write** permissions.
  3. Generate your API Key, API Secret, Access Token, and Access Token Secret.
- **Environment Variables**:
  ```bash
  X_API_KEY=xxxxxxxxxxxxxxxx
  X_API_SECRET=xxxxxxxxxxxxxxxx
  X_ACCESS_TOKEN=xxxxxxxxxxxxxxxx
  X_ACCESS_TOKEN_SECRET=xxxxxxxxxxxxxxxx
  ```

---

### 5. Shopee Video
- **API**: Shopee Open Platform v2 (Media Space API)
- **Portal**: [Shopee Open Platform](https://open.shopee.com/)
- **Setup**:
  1. Apply for Shopee Partner Account authorization.
  2. Obtain partner credentials and perform HMAC-SHA256 signature generation.
- **Environment Variables**:
  ```bash
  SHOPEE_PARTNER_ID=1000000
  SHOPEE_PARTNER_KEY=xxxxxxxxxxxxxxxx
  SHOPEE_SHOP_ID=12345678
  SHOPEE_ACCESS_TOKEN=xxxxxxxxxxxxxxxx
  SHOPEE_REGION=TH           # TH, SG, MY, ID, PH, VN
  ```

---

## 🎨 Niche Pack Caption Customization

Captions are dynamically driven by the active niche pack (`niche.json`). You can customize the caption format per platform under the `social.captionTemplates` section:

```json
"social": {
  "captionTemplates": {
    "tiktok": "{{title}} {{hashtags}}",
    "youtube": "{{title}}\n\n{{description}}\n\n{{hashtags}}\n\n{{factCheckDisclaimer}}",
    "facebook": "{{title}}\n\n{{description}}",
    "x_thread": "{{title}} (1/5)\n\n{{hashtags}}",
    "instagram": "{{title}}\n.\n.\n{{description}}\n.\n{{hashtags}}"
  }
}
```

### Template Variables
| Variable | Description | Example |
|---|---|---|
| `{{title}}` | Script title | *The $400,000 Leverage Trap* |
| `{{description}}` | High-level summary / hook | *Alex traded meme stocks and got leverage trapped.* |
| `{{hashtags}}` | Niche-relevant hashtags | *#finance #moneytok #investing* |
| `{{factCheckDisclaimer}}` | Fact-check / legal disclaimer | *For educational purposes only. Not financial advice.* |

---

## 💻 Python Usage Example

```python
from engine.niche_loader import load_niche
from engine.publishing import publish_all_platforms, PublishStateManager

pack = load_niche("example-finance")
state_manager = PublishStateManager("output/publish_state.json")

# 1. Dry-run publish across all configured platforms (Default)
results = publish_all_platforms(
    video_path="output/smoke_test_finance.mp4",
    title="The $400,000 Leverage Trap",
    description="How leverage wipes out accounts in days.",
    hashtags="#finance #investing #stocks",
    pack=pack,
    dry_run=True,  # Safe preview, zero network calls
    state_manager=state_manager,
    video_id="vid_finance_001",
)

for platform, res in results.items():
    print(f"[{platform.upper()}] Status: {res.status}, URL: {res.post_url}")

# 2. Live publish to a specific platform (opt-in)
# result = publish_to_platform(
#     platform="youtube",
#     video_path="output/smoke_test_finance.mp4",
#     title="The $400,000 Leverage Trap",
#     description="How leverage wipes out accounts.",
#     hashtags="#finance #investing",
#     dry_run=False,  # Dispatches real network upload
# )
```
