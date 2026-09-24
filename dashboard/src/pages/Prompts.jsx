import { useEffect, useState } from "react";
import { api } from "../api";
import { toast } from "../components/Toast.jsx";
import { useNiche } from "../context/NicheContext.jsx";

const PROMPT_LABELS = {
  screener: { icon: "🔍", label: "Screener", desc: "Viral score + copyright risk" },
  script_short: { icon: "✍️", label: "Short Script", desc: "45-60s TikTok/Reels" },
  script_long: { icon: "🎬", label: "Global Script", desc: "Global audience adaptation" },
};

export default function Prompts() {
  const { niche } = useNiche();
  const [prompts, setPrompts] = useState(null);
  const [activeKey, setActiveKey] = useState("screener");
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [niche]);

  async function load() {
    try {
      const data = await api.getPrompts();
      if (data && Object.keys(data).length > 0) {
        setPrompts(data);
        if (!activeKey) setActiveKey(Object.keys(data)[0]);
      } else {
        throw new Error("No remote prompts");
      }
    } catch {
      const fallback = {
        screener: {
          prompt: `You are an AI screener for niche: ${niche?.name || "ProofEngine"}.\n\nScore incoming story topics strictly against criteria:\n- Dramatic Arc & High Contrast\n- Universal Relatable Takeaway\n- Viral Hook Potential (first 3 seconds)\n- Visual Footage Availability`,
          desc: "AI Screening prompt for topic scoring"
        },
        script_short: {
          prompt: `You are a premier documentary short scriptwriter for niche: ${niche?.name || "ProofEngine"}.\n\nWrite an engaging 45-60s vertical short following the story beats:\n${niche?.storyBeats?.map(b => `- [${b.id.toUpperCase()}]: ${b.label} (${b.targetSeconds?.[0] || 0}-${b.targetSeconds?.[1] || 0}s)`).join("\n") || "- HOOK\n- SETUP\n- BREAKDOWN\n- LESSON\n- CTA"}`,
          desc: "Primary language script generator"
        },
        script_long: {
          prompt: `You are a global documentary narrator and script doctor.\n\nAdapt this script for a worldwide international audience with universal cultural resonance, relatable analogies, and concise pacing strictly under 60 seconds.`,
          desc: "Global audience adaptation"
        },
      };
      setPrompts(fallback);
      if (!activeKey) setActiveKey("screener");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (prompts && activeKey) setEditText(prompts[activeKey].prompt);
  }, [activeKey, prompts]);

  async function handleSave() {
    if (!activeKey) return;
    setSaving(true);
    try {
      await api.patchPrompt(activeKey, editText);
      toast("✅ Prompt saved — takes effect on next LLM call");
      load();
    } catch (e) { toast("Error: " + e.message); }
    setSaving(false);
  }

  async function handleReset() {
    if (!activeKey) return;
    if (!confirm("Reset this prompt to default? (requires restart)")) return;
    try {
      await api.resetPrompt(activeKey);
      toast("🔄 Override removed — restart to fully restore");
      load();
    } catch (e) { toast("Error: " + e.message); }
  }

  if (loading) return <div className="meta" style={{ padding: 40 }}>Loading…</div>;
  if (!prompts) return null;

  const active = prompts[activeKey];
  const meta = PROMPT_LABELS[activeKey] || { icon: "📝", label: activeKey, desc: "" };

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h2>📝 Prompts / Templates</h2>
      <p className="meta" style={{ marginTop: 4 }}>Edit AI system prompts. Changes are saved to the database — they persist across restarts and apply to all processes (web + worker).</p>

      {/* Tab selector */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {Object.entries(PROMPT_LABELS).map(([key, m]) => (
          <button key={key}
            className={activeKey === key ? "" : "secondary"}
            onClick={() => setActiveKey(key)}
            style={{ opacity: activeKey === key ? 1 : 0.6 }}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Editor */}
      {active && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <h3>{meta.icon} {meta.label}</h3>
            <span className="meta">{meta.desc}</span>
            <span className="meta" style={{ marginLeft: "auto" }}>
              {editText.length.toLocaleString()} chars (default: {active.default_length?.toLocaleString() || "?"})
            </span>
          </div>

          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            style={{
              width: "100%", minHeight: 500, padding: 16,
              background: "rgba(0,0,0,0.3)", color: "#e0e0e0",
              border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
              fontFamily: "monospace", fontSize: 13, lineHeight: 1.5,
              resize: "vertical",
            }}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "💾 Save & Apply"}
            </button>
            <button className="secondary" onClick={handleReset}>🔄 Reset to Default</button>
          </div>
        </div>
      )}
    </div>
  );
}
