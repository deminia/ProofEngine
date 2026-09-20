import os
import sys
from pathlib import Path

# Fix Windows console UTF-8 output
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


# Set up ProofEngine path
ROOT = Path("D:/Demini/ProofEngine")
sys.path.insert(0, str(ROOT))

# Load .env
env_file = ROOT / ".env"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

# Fallback to ProofKarma backend .env for keys if needed
pk_env = Path("D:/Demini/ProofKarma/backend/.env")
if pk_env.exists():
    for line in pk_env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

from engine.niche_loader import load_niche, VoiceSettings
from engine.scripting import ScriptResult
from engine.voice import EdgeTTSProvider, synthesize_voice, get_audio_duration
from engine.assembly import assemble_video, RenderResult

def main():
    print("=" * 60)
    print("PROOFENGINE E2E VIDEO RENDER RUNNER")
    print("=" * 60)

    pack = load_niche("example-finance", base_dir=ROOT)
    output_dir = ROOT / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Prepare ScriptResult from our verified leverage trap case
    script_body = (
        "A 24-year-old turned $15,000 into $1.2 million in just 9 months trading meme stocks. "
        "Then lost it all — plus ended up $400,000 in debt.\n\n"
        "Alex started with his life savings during the 2020 trading frenzy, buying call options — "
        "basically bets that stocks would go up. He rode the wave, quit his job, and felt unstoppable.\n\n"
        "Here's where it went sideways. He borrowed $300,000 against his portfolio to buy 3x leveraged ETFs — "
        "funds that amplify gains but also triple your losses. When tech stocks crashed 60% in 2022, he didn't sell. "
        "He doubled down using credit cards and more margin loans.\n\n"
        "Within two weeks, margin calls wiped him out completely. Zero dollars left. But he still owed $400,000 "
        "to his brokerage and credit card companies. That's like losing your entire net worth and then being handed "
        "a mortgage with no house.\n\n"
        "The lesson? Leverage multiplies everything — including disaster. If you're investing money you borrowed, "
        "you're not investing. You're gambling with a loaded gun. Stick to what you own, diversify, and never bet more "
        "than you can afford to lose.\n\n"
        "Would you risk borrowed money for a shot at millions, or play the long game? Comment below."
    )

    resolved_voice = pack.config.voice.resolve_voice(tier_id="market_traps", category_id="crypto_blowups")
    print(f"Bound Voice Settings: {resolved_voice.voiceId} (rate: {resolved_voice.rate}, pitch: {resolved_voice.pitch})")

    visual_keywords = [
        "stock chart plunge red",
        "stressed trader hands on head",
        "margin call warning screen",
        "credit card debt bills",
        "empty wallet zero money",
        "safe investing piggy bank",
    ]

    script = ScriptResult(
        title="From $1.2M to -$400K: The Leverage Trap",
        body=script_body,
        hashtags="#finance #investing #moneytok #leverage #daytrading #stockmarket #wealth",
        description="Alex turned $15,000 into $1.2M before leverage wiped him out to -$400K. Learn the golden rules of risk management.",
        visual_keywords=visual_keywords,
        hook_variants=[
            "He made $1.2 million in 9 months. Then lost it all plus $400K more.",
            "$15,000 became $1.2 million — then negative $400,000. Here's how.",
        ],
        beats=pack.config.storyBeats,
        voice_settings=resolved_voice,
        target_duration=55,
        estimated_duration=58.0,
    )

    # 2. Synthesize Real Audio via EdgeTTS
    print("\n[STEP 1: TEXT-TO-SPEECH SYNTHESIS]")
    audio_path = output_dir / "smoke_test_finance.mp3"
    tts_provider = EdgeTTSProvider()
    print(f"Synthesizing voice narration with {resolved_voice.voiceId}...")
    max_dur = float(pack.config.visual.durationSeconds[1])
    print(f"Enforcing Layer 2 Duration Guard: target max <= {max_dur}s (threshold <= {max_dur * 1.05}s)")
    audio_res = synthesize_voice(
        script,
        str(audio_path),
        provider=tts_provider,
        max_duration_seconds=max_dur,
    )
    print(f"[OK] Audio generated: {audio_res.audio_path} ({audio_res.duration_seconds}s)")
    print(f"Final Script Body ({len(script.body.split())} words):\n{script.body}")
    print(f"[OK] Audio generated: {audio_res.audio_path} ({audio_res.duration_seconds}s)")

    # 3. Assemble Full Video via FFmpeg
    print("\n[STEP 2: FFMPEG VIDEO ASSEMBLY]")
    video_output_path = output_dir / "smoke_test_finance.mp4"
    pexels_key = os.environ.get("PEXELS_API_KEY", "")
    print(f"Pexels Key present: {bool(pexels_key)}")
    print(f"Output Video Path: {video_output_path}")

    render_res = assemble_video(
        script=script,
        audio=audio_res,
        output_video_path=str(video_output_path),
        pack=pack,
        pexels_api_key=pexels_key,
        burn_subtitles=True,
    )

    print("\n" + "=" * 60)
    print("[OK] E2E VIDEO RENDER COMPLETED!")
    print(f"Video Path: {render_res.video_path}")
    print(f"File Size: {Path(render_res.video_path).stat().st_size / (1024 * 1024):.2f} MB")
    print(f"Duration: {render_res.duration_seconds}s")
    print(f"Resolution: {render_res.resolution}")
    print(f"Clips Sequenced: {render_res.footage_count}")
    print(f"Burned Subtitles: {render_res.has_subtitles}")
    print("=" * 60)

if __name__ == "__main__":
    main()
