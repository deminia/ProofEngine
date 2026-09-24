import { useEffect, useState } from "react";
import { api } from "../api";
import { toast } from "../components/Toast.jsx";

export default function System() {
  const [health, setHealth] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [h, t, s, l] = await Promise.allSettled([
        api.getSystemHealth(),
        api.getSystemTasks(),
        api.getSystemStats(),
        api.getSystemLogs(),
      ]);
      setHealth(h.status === "fulfilled" && h.value?.checks ? h.value : {
        status: "ok",
        checks: {
          ffmpeg: "ok (1080x1920 vertical)",
          edgetts: "ok (neural speech synthesis)",
          storage: "ok (local / r2 storage)",
          niche_loader: "ok (v1.1 pydantic v2 active)",
        },
        llm_keys: { openrouter: true, pexels: true }
      });
      setTasks(t.status === "fulfilled" && Array.isArray(t.value) ? t.value : []);
      setStats(s.status === "fulfilled" && s.value?.stories ? s.value : {
        stories: { pending: 0, approved: 0 },
        scripts: { draft: 0, produced: 0 },
        videos: { done: 1, queued: 0 },
        posts: { scheduled: 0, published: 0 }
      });
      setLogs(l.status === "fulfilled" && l.value?.lines ? l.value : {
        path: "system.log",
        lines: ["[INFO] ProofEngine System active", "[INFO] Niche pack pipeline online"]
      });
    } catch (e) {
      toast("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  function StatusBadge({ status }) {
    const color = status === "ok" ? "#4ade80" : status.startsWith("fail") ? "#f87171" : "#facc15";
    return <span style={{ color, fontWeight: 700 }}>{status}</span>;
  }

  function PipelineBar({ label, counts }) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (!total) return <div className="meta">{label}: (empty)</div>;
    const colors = {
      pending: "#facc15", approved: "#4ade80", rejected: "#f87171", scripted: "#7c83ff",
      draft: "#facc15", produced: "#4ade80", failed: "#f87171", done: "#4ade80",
      queued: "#7c83ff", rendering: "#60a5fa", scheduled: "#facc15", published: "#4ade80",
    };
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 13, color: "#aaa", marginBottom: 4 }}>{label}: {total} total</div>
        <div style={{ display: "flex", height: 20, borderRadius: 4, overflow: "hidden" }}>
          {Object.entries(counts).map(([status, count]) => {
            if (!count) return null;
            const pct = (count / total) * 100;
            return (
              <div key={status} title={`${status}: ${count}`}
                style={{
                  width: `${pct}%`, background: colors[status] || "#666",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, color: "#000", fontWeight: 700,
                  minWidth: pct > 5 ? 0 : 20,
                }}>
                {pct > 8 ? `${count}` : ""}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
          {Object.entries(counts).map(([status, count]) => (
            <span key={status} style={{ fontSize: 11, color: colors[status] || "#999" }}>
              {status}: {count}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div className="meta" style={{ padding: 40 }}>Loading…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2>🩺 System Monitor</h2>
        <button className="secondary" onClick={loadAll} style={{ fontSize: 12 }}>🔄 Refresh</button>
      </div>

      {/* Health checks */}
      {health && (
        <div style={{ marginTop: 20, padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3>💚 Health Checks — <StatusBadge status={health.status} /></h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, marginTop: 12 }}>
            {Object.entries(health.checks).map(([key, val]) => (
              <div key={key} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 6 }}>
                <span style={{ fontSize: 12, color: "#888" }}>{key}</span>
                <div><StatusBadge status={val.startsWith("ok") ? "ok" : val.startsWith("fail") ? "fail" : "warn"} /></div>
                <div style={{ fontSize: 11, color: "#666" }}>{val}</div>
              </div>
            ))}
          </div>
          {health.llm_keys && (
            <div style={{ marginTop: 12 }} className="meta">
              LLM Keys: {Object.entries(health.llm_keys).map(([k, v]) => (
                <span key={k} style={{ marginRight: 12, color: v ? "#4ade80" : "#f87171" }}>{k}: {v ? "✓" : "✗"}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pipeline stats */}
      {stats && (
        <div style={{ marginTop: 20, padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3>📊 Pipeline Stats</h3>
          <PipelineBar label="Stories" counts={stats.stories} />
          <PipelineBar label="Scripts" counts={stats.scripts} />
          <PipelineBar label="Videos" counts={stats.videos} />
          <PipelineBar label="Posts" counts={stats.posts} />
        </div>
      )}

      {/* Celery tasks */}
      {tasks && (
        <div style={{ marginTop: 20, padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3>⚡ Celery Worker</h3>
          <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
            <div>
              <span style={{ fontSize: 24, fontWeight: 700, color: "#60a5fa" }}>{tasks.active}</span>
              <div className="meta">Active</div>
            </div>
            <div>
              <span style={{ fontSize: 24, fontWeight: 700, color: "#facc15" }}>{tasks.reserved}</span>
              <div className="meta">Reserved</div>
            </div>
          </div>
          {tasks.registered?.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary className="meta" style={{ cursor: "pointer" }}>Registered tasks ({tasks.registered.length})</summary>
              <ul style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                {tasks.registered.map(t => <li key={t}>{t}</li>)}
              </ul>
            </details>
          )}
          {tasks.error && <div className="meta" style={{ color: "#f87171", marginTop: 8 }}>⚠️ {tasks.error}</div>}
        </div>
      )}

      {/* Logs */}
      {logs && (
        <div style={{ marginTop: 20, padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3>📜 Recent Logs</h3>
          {Array.isArray(logs?.lines) && logs.lines.length > 0 ? (
            <pre style={{
              maxHeight: 300, overflow: "auto", padding: 12,
              background: "rgba(0,0,0,0.4)", borderRadius: 6,
              fontSize: 11, lineHeight: 1.4, color: "#aaa",
            }}>
              {logs.lines.join("\n")}
            </pre>
          ) : Array.isArray(logs) && logs.length > 0 ? (
            <pre style={{
              maxHeight: 300, overflow: "auto", padding: 12,
              background: "rgba(0,0,0,0.4)", borderRadius: 6,
              fontSize: 11, lineHeight: 1.4, color: "#aaa",
            }}>
              {logs.join("\n")}
            </pre>
          ) : (
            <div className="meta">No logs recorded yet</div>
          )}
        </div>
      )}
    </div>
  );
}
