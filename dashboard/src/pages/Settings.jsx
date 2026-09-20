import { useEffect, useState } from "react";
import { api } from "../api";
import { useNiche } from "../context/NicheContext.jsx";
import { toast } from "../components/Toast.jsx";

export default function Settings() {
  const [data, setdata] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setdata(await api.getSettings()); } catch (e) { toast("Error: " + e.message); }
    setLoading(false);
  }

  async function save(group, key, value) {
    try {
      // Map UI key to the flat patch payload
      const patch = {};
      const flatKey = key.toLowerCase();
      patch[flatKey] = value;
      await api.patchSettings(patch);
      toast("✅ Saved");
      load();
    } catch (e) { toast("Error: " + e.message); }
  }

  if (loading || !data) return <div className="meta" style={{ padding: 40 }}>Loading…</div>;

  const { llm, tts, screener, audio, video, publish: pub, scanner, storage } = data;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2>⚙️ Settings</h2>

      {/* Niche Pack Selector */}
      <NicheSection />

      {/* LLM */}
      <Section title="🤖 LLM Provider" onSave={() => save("llm", "llm_provider", undefined)}>
        <Row label="Provider">
          <select value={llm.provider} onChange={e => save("llm", "llm_provider", e.target.value)}>
            <option value="openrouter">OpenRouter</option>
            <option value="fireworks">Fireworks AI</option>
            <option value="google">Google Gemini</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </Row>
        <Row label="Tier">
          <select value={llm.tier} onChange={e => save("llm", "llm_tier", e.target.value)}>
            {llm.tier_available.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Row>
        <div className="meta" style={{ marginTop: 8 }}>
          API Keys: {Object.entries(llm.keys).map(([k, v]) => (
            <span key={k} style={{ marginRight: 12, color: v ? "#4ade80" : "#f87171" }}>
              {k}: {v ? "✓" : "✗"}
            </span>
          ))}
        </div>
      </Section>

      {/* TTS */}
      <Section title="🎙️ TTS Voice">
        <Row label="Provider">
          <select value={tts.provider} onChange={e => save("tts", "tts_provider", e.target.value)}>
            <option value="auto">Auto (ElevenLabs → Edge)</option>
            <option value="edge">Edge-TTS (Free)</option>
            <option value="elevenlabs">ElevenLabs</option>
          </select>
        </Row>
        <Row label="Voice">
          <select value={tts.edge_voice} onChange={e => save("tts", "edge_tts_voice", e.target.value)}>
            <option value="th-TH-PremwadeeNeural">Premwadee (Female)</option>
            <option value="th-TH-NiwatNeural">Niwat (Male)</option>
          </select>
        </Row>
        <Row label={`Speed (${tts.speed.toFixed(1)}x)`}>
          <input type="range" min="0.7" max="1.5" step="0.1" value={tts.speed}
            onChange={e => save("tts", "tts_speed", parseFloat(e.target.value))} />
        </Row>
        <div className="meta">ElevenLabs: {tts.elevenlabs_configured ? "✓ Configured" : "✗ Not set"}</div>
      </Section>

      {/* Screener */}
      <Section title="🔍 Screener">
        <Row label={`Min Viral Score (${screener.min_viral_score.toFixed(1)})`}>
          <input type="range" min="1" max="10" step="0.5" value={screener.min_viral_score}
            onChange={e => save("screener", "min_viral_score", parseFloat(e.target.value))} />
        </Row>
      </Section>

      {/* Audio */}
      <Section title="🎵 Audio">
        <Row label="BGM">
          <label><input type="checkbox" checked={audio.bgm_enabled}
            onChange={e => save("audio", "bgm_enabled", e.target.checked)} /> Enabled</label>
        </Row>
        <Row label={`BGM Volume (${(audio.bgm_volume * 100).toFixed(0)}%)`}>
          <input type="range" min="0" max="1" step="0.05" value={audio.bgm_volume}
            onChange={e => save("audio", "bgm_volume", parseFloat(e.target.value))} />
        </Row>
        <Row label="SFX">
          <label><input type="checkbox" checked={audio.sfx_enabled}
            onChange={e => save("audio", "sfx_enabled", e.target.checked)} /> Enabled</label>
        </Row>
        <Row label={`SFX Volume (${(audio.sfx_volume * 100).toFixed(0)}%)`}>
          <input type="range" min="0" max="1" step="0.05" value={audio.sfx_volume}
            onChange={e => save("audio", "sfx_volume", parseFloat(e.target.value))} />
        </Row>
      </Section>

      {/* Video */}
      <Section title="🎬 Video">
        <Row label="Watermark">
          <label><input type="checkbox" checked={video.watermark_enabled}
            onChange={e => save("video", "watermark_enabled", e.target.checked)} /> Enabled</label>
        </Row>
        <Row label="Multi-Voice (Dialogue)">
          <label><input type="checkbox" checked={video.multi_voice_enabled}
            onChange={e => save("video", "multi_voice_enabled", e.target.checked)} /> Enabled</label>
        </Row>
      </Section>

      {/* Publish */}
      <Section title="📤 Auto-Publish">
        <Row label="Enabled">
          <label><input type="checkbox" checked={pub.auto_publish_enabled}
            onChange={e => save("publish", "auto_publish_enabled", e.target.checked)} /> Auto-publish</label>
        </Row>
        <Row label="Platforms">
          <input type="text" value={pub.auto_publish_platforms}
            onChange={e => save("publish", "auto_publish_platforms", e.target.value)}
            placeholder="youtube,tiktok" style={{ width: 200 }} />
        </Row>
        <Row label="Hour Range (BKK)">
          <input type="text" value={pub.publish_hour_range}
            onChange={e => save("publish", "publish_hour_range", e.target.value)}
            placeholder="19-21" style={{ width: 80 }} />
        </Row>
      </Section>

      {/* Scanner */}
      <Section title="📡 Viral Scanner">
        <Row label="Enabled">
          <label><input type="checkbox" checked={scanner.viral_scanner_enabled}
            onChange={e => save("scanner", "viral_scanner_enabled", e.target.checked)} /> Scan trending</label>
        </Row>
        <Row label="Interval (min)">
          <input type="number" min="5" max="360" value={scanner.viral_scanner_interval_min}
            onChange={e => save("scanner", "viral_scanner_interval_min", parseInt(e.target.value))}
            style={{ width: 80 }} />
        </Row>
      </Section>

      {/* Storage */}
      <Section title="💾 Storage">
        <div className="meta">
          R2: {storage.r2_enabled ? "✓ Active" : "✗ Local disk mode"} • Root: {storage.media_root}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children, onSave }) {
  return (
    <div style={{ marginTop: 24, padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
      <h3 style={{ marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
      <span style={{ width: 180, fontSize: 13, color: "#aaa", flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}


function NicheSection() {
  const { niche, switchNiche } = useNiche();
  const [packs, setPacks] = useState([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    api.listNiches().then(setPacks).catch(() => {});
  }, [niche]);

  const handleSwitch = async (e) => {
    const newId = e.target.value;
    if (!newId || newId === niche?.id) return;
    try {
      setSwitching(true);
      await switchNiche(newId);
      toast(`✅ Switched to niche pack: ${newId}`);
    } catch (err) {
      toast(`Switch failed: ${err.message}`);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="card" style={{ padding: 18, marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>📦 Niche Pack Configuration</h3>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Active Niche Pack:</span>
        <select
          value={niche?.id || ""}
          onChange={handleSwitch}
          disabled={switching}
          style={{ maxWidth: 280, fontSize: 13, padding: "5px 10px" }}
        >
          {packs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id}) {p.isPrivate ? "🔒 [Private]" : ""}
            </option>
          ))}
        </select>
      </div>
      {niche && (
        <div className="meta" style={{ lineHeight: 1.6, fontSize: 12 }}>
          <div><strong>Name:</strong> {niche.name} (v{niche.version})</div>
          <div><strong>Description:</strong> {niche.description || "N/A"}</div>
          <div><strong>Duration:</strong> {niche.visual?.durationSeconds?.[0]}–{niche.visual?.durationSeconds?.[1]}s</div>
          <div><strong>Platforms:</strong> {niche.publishing?.platforms?.join(", ")}</div>
        </div>
      )}
    </div>
  );
}
