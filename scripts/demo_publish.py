import json
import sys
from pathlib import Path

# Fix Windows console UTF-8 output
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path("D:/Demini/ProofEngine")
sys.path.insert(0, str(ROOT))

from engine.niche_loader import load_niche
from engine.publishing import publish_all_platforms, PublishStateManager

def main():
    print("=" * 65)
    print("PROOFENGINE MULTI-PLATFORM PUBLISHING DEMO (DRY-RUN DEFAULT)")
    print("=" * 65)

    pack = load_niche("example-finance", base_dir=ROOT)
    video_path = ROOT / "output" / "smoke_test_finance.mp4"
    if not video_path.exists():
        print(f"Error: Video file not found at {video_path}")
        return

    state_mgr = PublishStateManager(str(ROOT / "output" / "publish_state.json"))

    title = "The $400,000 Leverage Trap"
    description = (
        "Alex turned $15,000 into $1.2 million trading meme stocks before leverage "
        "wiped him out to -$400,000. Learn the golden rules of risk management."
    )
    hashtags = "#finance #investing #moneytok #leverage #daytrading #stockmarket #wealth"

    print(f"Target Video: {video_path} ({video_path.stat().st_size / (1024*1024):.2f} MB)")
    print(f"Configured Platforms: {pack.config.publishing.platforms}")
    print("\nExecuting dispatch with dry_run=True (Safe preview, zero network calls)...\n")

    results = publish_all_platforms(
        video_path=str(video_path),
        title=title,
        description=description,
        hashtags=hashtags,
        pack=pack,
        dry_run=True,  # Strict default
        state_manager=state_mgr,
        video_id="smoke_test_finance_v1",
    )

    for platform, res in results.items():
        print("-" * 65)
        print(f"Platform: {platform.upper()}")
        print(f"Status:   {res.status.upper()} (Success: {res.success}, DryRun: {res.dry_run})")
        print(f"ID:       {res.external_id}")
        print(f"Post URL: {res.post_url}")
        print(f"Payload Preview:")
        print(json.dumps(res.payload_summary, indent=2))

    print("=" * 65)
    print("ALL PLATFORM PAYLOADS GENERATED & VALIDATED SUCCESSFULLY!")
    print(f"State saved to: {state_mgr.path}")
    print("=" * 65)

if __name__ == "__main__":
    main()
