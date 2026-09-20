import { useEffect, useState } from "react";
import { api } from "../api";
import { toast } from "../components/Toast.jsx";
import { parseBackendTs } from "./Calendar.jsx";

// Backend stores naive UTC timestamps; reuse Calendar's parseBackendTs so
// "collected_at" / "published_at" both render in the viewer's local zone.
function fmtLocal(ts) {
  const d = parseBackendTs(ts);
  if (!d) return "—";
  return d.toLocaleString();
}

const PLATFORM_LABEL = {
  youtube:    "▶️ YouTube",
  tiktok:     "🎵 TikTok",
  instagram:  "📸 Instagram",
  facebook:   "👥 Facebook",
  shopee:     "🛒 Shopee",
  shopee_video: "🛒 Shopee Video",
  x:          "𝕏 Twitter",
  twitter:    "𝕏 Twitter",
};

function fmtNum(n) {
  // 1.2K / 3.4M for compact display, full integer toLocaleString otherwise.
  const v = n || 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return v.toLocaleString();
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { api.analytics().then(setData); }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const fresh = await api.refreshAnalytics();
      setData(fresh);
      toast("รีเฟรชยอดวิว/ไลก์/คอมเมนต์เรียบร้อย");
    } catch (e) {
      toast("รีเฟรชล้มเหลว: " + (e?.message || "unknown error"));
    } finally {
      setRefreshing(false);
    }
  }

  if (!data) return <div>Loading…</div>;

  const posts = data.posts || [];
  const published = posts.filter((p) => p.status === "published");
  const collected = posts.filter((p) => p.collected_at);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="page-title">📊 Analytics</div>
          <div className="page-sub">รวมจากทุก platform</div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            background: refreshing ? "#222" : "var(--accent)",
            color: "#fff", border: 0, borderRadius: 8,
            padding: "8px 14px", fontWeight: 700, cursor: refreshing ? "wait" : "pointer",
          }}
        >
          {refreshing ? "⏳ กำลังดึงสถิติ…" : "🔄 Refresh now"}
        </button>
      </div>

      <div className="stats">
        <div className="stat"><div className="label">Total Views</div><div className="value">{fmtNum(data.total_views)}</div></div>
        <div className="stat"><div className="label">Total Likes</div><div className="value">{fmtNum(data.total_likes)}</div></div>
        <div className="stat"><div className="label">Total Comments</div><div className="value">{fmtNum(data.total_comments || 0)}</div></div>
        <div className="stat"><div className="label">Total Shares</div><div className="value">{fmtNum(data.total_shares || 0)}</div></div>
        <div className="stat"><div className="label">Total Posts</div><div className="value">{data.total_posts}</div></div>
      </div>

      {/* Per-post breakdown — the most useful view for "is anything actually
          getting traction?". Sorted by views desc on the backend so the top
          row is your current best performer. */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3>📋 ต่อโพสต์ ({published.length} published / {collected.length} ดึงสถิติแล้ว)</h3>
          <span className="meta">รีเฟรชล่าสุด: {data.posts?.[0]?.collected_at ? fmtLocal(data.posts[0].collected_at) : "—"}</span>
        </div>

        {posts.length === 0 ? (
          <div className="meta" style={{ marginTop: 8 }}>
            ยังไม่มี post — เผยแพร่จากหน้า Videos ก่อน แล้วกด <b>🔄 Refresh now</b>
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "8px 6px" }}>Platform</th>
                  <th style={{ padding: "8px 6px" }}>Title</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>👁 Views</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>❤ Likes</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>💬 Comments</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>🔁 Shares</th>
                  <th style={{ padding: "8px 6px" }}>Status</th>
                  <th style={{ padding: "8px 6px" }}>Published</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #1a1a2e" }}>
                    <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                      {PLATFORM_LABEL[p.platform] || p.platform}
                    </td>
                    <td style={{ padding: "8px 6px", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis" }}>
                      <div style={{ color: "#fff", fontWeight: 600 }}>{p.title || `post #${p.id}`}</div>
                      {p.external_id && (
                        <div className="meta" style={{ fontSize: 11 }}>id: {p.external_id}</div>
                      )}
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: p.views > 0 ? "#4cc9f0" : "#666" }}>
                      {fmtNum(p.views)}
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "right", color: p.likes > 0 ? "#f72585" : "#666" }}>
                      {fmtNum(p.likes)}
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "right", color: p.comments > 0 ? "#ffd60a" : "#666" }}>
                      {fmtNum(p.comments)}
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "right", color: p.shares > 0 ? "#06d6a0" : "#666" }}>
                      {fmtNum(p.shares)}
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <span className={`badge ${p.status}`}>{p.status}</span>
                    </td>
                    <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }} className="meta">
                      {fmtLocal(p.published_at || p.scheduled_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Help text — most users hit this page once and immediately wonder
            "why are all numbers zero?". Spell out the 3 reasons inline so
            we don't have to triage them in DMs. */}
        {published.length > 0 && published.every((p) => p.views === 0 && p.likes === 0) && (
          <div className="meta" style={{ marginTop: 12, padding: 10, background: "#1a1a2e", borderRadius: 8, fontSize: 12, lineHeight: 1.5 }}>
            <b>ตัวเลขยังเป็น 0?</b> สาเหตุที่พบบ่อย:
            <br />• <b>YouTube</b> — ต้องมี <code>YOUTUBE_TOKEN_FILE</code> (OAuth) → กด Refresh now หลัง publish
            <br />• <b>TikTok / Instagram</b> — ยังไม่มี API → ต้องใส่ตัวเลขเองที่หน้า Videos → "📊 Manual upload tracking"
            <br />• <b>เพิ่งเผยแพร่</b> — รอ 5–10 นาทีให้ platform index ก่อนกด Refresh
          </div>
        )}
      </div>

      {/* Time-series tail — keeps growth-over-time data visible for users
          who want a sanity check that the collector is actually appending. */}
      {(data.rows || []).length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>🕒 Recent collection rows ({data.rows.length} ทั้งหมด)</h3>
          {(data.rows || []).slice(-20).reverse().map((r) => (
            <div key={r.id} className="row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1a1a2e", fontSize: 12 }}>
              <span>post #{r.post_id} <span className="meta">{fmtLocal(r.collected_at)}</span></span>
              <span className="meta">👁 {fmtNum(r.views)} • ❤ {fmtNum(r.likes)} • 💬 {fmtNum(r.comments)} • 🔁 {fmtNum(r.shares)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
