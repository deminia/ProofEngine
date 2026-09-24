import { useEffect, useState, useMemo } from "react";
import { api } from "../api";
import { useNiche } from "../context/NicheContext.jsx";
import { toast } from "../components/Toast.jsx";
import { Dropdown } from "../components/Dropdown.jsx";

const FILTERS = [
  { key: "pending", label: "🟡 Pending" },
  { key: "approved", label: "✅ Approved" },
  { key: "rejected", label: "🗑 Rejected" },
  { key: "scripted", label: "📝 Scripted" },
  { key: "", label: "📂 All" },
];

const SCORE_THRESHOLD = 7.0;

function getKeywords(title) {
  if (!title) return [];
  return title.toLowerCase()
    .replace(/[^\w\u0E00-\u0E7F]+/g, ' ')
    .split(' ')
    .filter(w => w.length > 3 && !['and', 'the', 'เรื่อง', 'ของ', 'ใน', 'กับ', 'คือ', 'ที่', 'ว่า', 'การ', 'ความ'].includes(w));
}

function findLikelyDuplicates(story, allItems) {
  if (story.status !== "pending") return [];
  const myWords = getKeywords(story.title);
  if (!myWords.length) return [];
  
  return allItems.filter(other => {
    if (other.id === story.id) return false;
    if (other.status === "pending" || other.status === "rejected") return false;
    
    const otherWords = getKeywords(other.title);
    const overlap = myWords.filter(w => otherWords.includes(w)).length;
    const hasLongMatch = myWords.some(w => w.length > 5 && otherWords.includes(w));
    return hasLongMatch || overlap >= 2;
  }).slice(0, 2);
}

export default function Queue() {
  const { niche } = useNiche();
  const tiers = (niche?.discoveryTiers && niche.discoveryTiers.length > 0) ? niche.discoveryTiers : [
    { id: "all", label: "Stories", emoji: "⚡", categories: [] }
  ];
  const [activeCategoryTab, setActiveCategoryTab] = useState("");
  useEffect(() => {
    if (tiers.length > 0 && !activeCategoryTab) {
      setActiveCategoryTab(tiers[0].id);
    }
  }, [tiers, activeCategoryTab]);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [hideLowScore, setHideLowScore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedCards, setExpandedCards] = useState(new Set());
  

  async function load() {
    setLoading(true);
    try {
      const data = await api.listStories();
      data.sort((a, b) => b.id - a.id);
      setItems(data);
      const c = { total: data.length };
      data.forEach(x => { c[x.status] = (c[x.status] || 0) + 1; });
      setCounts(c);
      setSelectedIds(new Set());
    } catch (e) {
      toast("Error loading queue: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  const visibleItems = useMemo(() => {
    return items.filter(s => {
      if (filter && s.status !== filter) return false;
      if (hideLowScore && filter !== "rejected") {
        if (s.viral_score != null && s.viral_score < SCORE_THRESHOLD) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (s.title || "").toLowerCase().includes(q);
        const hookMatch = (s.emotional_hook || "").toLowerCase().includes(q);
        if (!titleMatch && !hookMatch) return false;
      }
      return true;
    });
  }, [items, filter, hideLowScore, searchQuery]);

  const hiddenCount = items.filter(s => filter ? s.status === filter : true).length - visibleItems.length;

  useEffect(() => { load(); }, [filter]);

  useEffect(() => {
    const hasUnscored = items.some(s => s.viral_score == null && s.status === "pending");
    if (!hasUnscored) return undefined;
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [items]);

  async function approve(id) {
    await api.approveStory(id);
    toast("✓ Approved — กำลัง generate script");
    load();
  }

  async function reject(id) {
    await api.rejectStory(id);
    toast("🗑 ปฏิเสธเรื่องแล้ว");
    load();
  }

  async function destroy(id) {
    if (!confirm("ลบเรื่องนี้ออกจากระบบถาวร?")) return;
    await api.deleteStory(id);
    toast("ลบเรื่องสำเร็จ");
    load();
  }

  async function handleBulkApprove() {
    const count = selectedIds.size;
    if (!count) return;
    if (!confirm(`อนุมัติ ${count} เรื่องที่เลือกพร้อมกันและเริ่มสร้างสคริปต์?`)) return;
    
    let approved = 0;
    for (const id of selectedIds) {
      try {
        await api.approveStory(id);
        approved++;
      } catch (err) {
        console.error("Bulk approve failed for", id, err);
      }
    }
    toast(`✓ อนุมัติสำเร็จ ${approved}/${count} เรื่อง!`);
    load();
  }

  async function cleanupRejected() {
    if (!confirm(`ลบ rejected ทั้งหมด (${counts.rejected || 0} เรื่อง) ถาวร?`)) return;
    const r = await api.cleanupRejected();
    toast(`ลบไป ${r.removed} เรื่อง`);
    load();
  }

  async function cleanupPending() {
    if (!confirm(`ลบข่าว pending ทั้งหมด (${counts.pending || 0} เรื่อง) ถาวร?`)) return;
    const r = await api.cleanupPending();
    toast(`ลบข่าว pending ไป ${r.removed} เรื่อง`);
    load();
  }

  async function scan() {
    await api.scanStories();
    toast("🤖 RSS scan triggered (ใช้เวลา 10-30 วิ)");
    setTimeout(load, 3000);
  }

  async function findClassic(theme) {
    await api.findClassicStories(theme);
    toast(`🎯 ให้ AI หาเรื่องแนว ${theme} แล้ว`);
    setTimeout(load, 4000);
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === visibleItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleItems.map(s => s.id)));
    }
  };

  const toggleCardExpand = (id) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <div className="page-title">🔍 Story Queue</div>
      <div className="page-sub">
        คัดเลือกเรื่องไวรัลก่อนส่งต่อไปเขียนบทพากย์
        {counts.total != null && (
          <span style={{ marginLeft: 10, color: "var(--muted)" }}>
            ({counts.total} เรื่อง • รอตรวจ {counts.pending || 0} • อนุมัติแล้ว {counts.approved || 0})
          </span>
        )}
      </div>

      {/* Sticky Filter & Actions Bar */}
      <div className="sticky-toolbar">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          
          {/* Status Filter Tabs */}
          <div className="pill-tabs">
            {FILTERS.map((f) => (
              <button
                key={f.key || "all"}
                className={`pill-tab ${filter === f.key ? "active" : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label} {counts[f.key || "total"] != null ? `(${counts[f.key || "total"]})` : ""}
              </button>
            ))}
          </div>

          {/* Quick Actions & Cleanup */}
          <div className="row" style={{ gap: 8 }}>
            <button className="secondary sm" onClick={scan}>🤖 Scan RSS</button>
            <button className="secondary sm" onClick={load}>🔄 Refresh</button>
            <Dropdown
              trigger={<button className="secondary sm">🧹 เคลียร์ข้อมูล ▾</button>}
              items={[
                {
                  label: `ลบ Rejected ทั้งหมด (${counts.rejected || 0})`,
                  icon: "🗑️",
                  danger: true,
                  disabled: !counts.rejected,
                  onClick: cleanupRejected,
                },
                {
                  label: `ลบ Pending ทั้งหมด (${counts.pending || 0})`,
                  icon: "🧹",
                  danger: true,
                  disabled: !counts.pending,
                  onClick: cleanupPending,
                },
              ]}
            />
          </div>
        </div>

        {/* Search, Filter & Bulk Row */}
        <div className="row" style={{ marginTop: 12, justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div className="row" style={{ flex: "1 1 280px", maxWidth: 460 }}>
            <input
              type="text"
              placeholder="🔍 ค้นหาหัวข้อ หรือ ประเด็นเรื่อง..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: "6px 12px", fontSize: 13 }}
            />
            {searchQuery && (
              <button className="btn-subtle sm" onClick={() => setSearchQuery("")} title="ล้างคำค้น">✕</button>
            )}
          </div>

          <div className="row" style={{ gap: 14 }}>
            {filter !== "rejected" && (
              <label
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--muted)", cursor: "pointer", userSelect: "none" }}
                title={`ซ่อนเรื่องที่คะแนนต่ำกว่า ${SCORE_THRESHOLD.toFixed(1)}`}
              >
                <input type="checkbox" checked={hideLowScore} onChange={e => setHideLowScore(e.target.checked)} />
                <span>ซ่อน &lt; {SCORE_THRESHOLD.toFixed(1)}</span>
                {hideLowScore && hiddenCount > 0 && (
                  <span style={{ color: "var(--amber)", fontSize: 11 }}>({hiddenCount})</span>
                )}
              </label>
            )}

            {visibleItems.length > 0 && (
              <button className="btn-subtle sm" onClick={toggleSelectAll}>
                {selectedIds.size === visibleItems.length ? "☑ ปลดเลือกทั้งหมด" : "☐ เลือกทั้งหมด"}
              </button>
            )}

            {selectedIds.size > 0 && (
              <button className="success sm" onClick={handleBulkApprove}>
                ✓ Approve {selectedIds.size} เรื่องที่เลือก
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Section 1: AI Classic Finder */}
      <details className="custom-accordion">
        <summary>
          <span>🎯 AI Classic Finder (คลิกเพื่อเลือกหมวดหมู่ให้ AI ค้นเรื่องในอดีต)</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>ขยาย ▾</span>
        </summary>
        <div className="accordion-body">
          <div className="pill-tabs" style={{ marginBottom: 12, overflowX: "auto", background: "var(--panel2)" }}>
            {tiers.map(t => (
              <button
                key={t.id}
                className={`pill-tab ${activeCategoryTab === t.id ? "active" : ""}`}
                onClick={() => setActiveCategoryTab(t.id)}
                style={{
                  background: activeCategoryTab === t.id ? "var(--panel3)" : "transparent",
                  color: activeCategoryTab === t.id ? "#fff" : "var(--muted)",
                  border: activeCategoryTab === t.id ? "1px solid var(--border)" : "1px solid transparent",
                }}
              >
                <span>{t.emoji || "⚡"}</span> <span>{t.label}</span>
              </button>
            ))}
          </div>

          {(() => {
            const currentTier = tiers.find(t => t.id === activeCategoryTab) || tiers[0];
            const categories = currentTier?.categories || [];
            if (!categories.length) {
              return <div style={{ fontSize: 13, color: "var(--muted)", padding: 12 }}>ไม่มีหมวดหมู่ใน Tier นี้</div>;
            }
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                {categories.map((c) => (
                  <div key={c.id} style={{ background: "var(--panel3)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{c.emoji || "💡"}</span> <span>{c.label}</span>
                    </div>
                    {c.examples && c.examples.length > 0 && (
                      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                        {c.examples.map((ex, idx) => (
                          <button
                            key={idx}
                            className="secondary sm"
                            onClick={() => findClassic(ex)}
                            style={{
                              background: "rgba(255, 255, 255, 0.04)",
                              border: "1px solid var(--border)",
                              color: "var(--text-dim)",
                            }}
                          >
                            <span>⚡</span> <span>{ex}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </details>

      {/* Collapsible Section 2: Manual Story Entry */}
      <details className="custom-accordion">
        <summary>
          <span>📝 เพิ่มเรื่องด้วยตัวเอง (จาก URL หรือ เขียนข้อความ)</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>ขยาย ▾</span>
        </summary>
        <div className="accordion-body">
          <div className="row" style={{ gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
            {/* Box 1: URL */}
            <div style={{ flex: "1 1 300px", background: "var(--panel3)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🔗 ดึงเรื่องจาก URL</div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const url = formData.get("url");
                if (!url) return;
                try {
                  const res = await api.createStory({ title: "ดึงข้อมูลจาก URL...", url, source: "manual_url", content: "" });
                  toast(res.duplicate ? "⚠️ URL นี้เคยมีในระบบแล้ว" : "✅ เพิ่มเรื่องจาก URL สำเร็จ รอ Screen...");
                  e.target.reset();
                  setTimeout(load, 1500);
                } catch (err) { toast("Error: " + err.message); }
              }}>
                <input type="url" name="url" placeholder="https://..." required style={{ marginBottom: 8 }} />
                <button type="submit" className="primary sm" style={{ width: "100%" }}>ดึงเรื่องจาก URL</button>
              </form>
            </div>

            {/* Box 2: Text */}
            <div style={{ flex: "1 1 300px", background: "var(--panel3)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>✍️ เขียนเรื่องด้วยตัวเอง</div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const title = formData.get("title");
                const content = formData.get("content");
                if (!title || !content) return;
                try {
                  await api.createStory({ title, content, source: "manual_text", url: "" });
                  toast("✅ สร้างเรื่องจากข้อความสำเร็จ รอ Screen...");
                  e.target.reset();
                  setTimeout(load, 1500);
                } catch (err) { toast("Error: " + err.message); }
              }}>
                <input type="text" name="title" placeholder="หัวข้อเรื่อง" required style={{ marginBottom: 8 }} />
                <textarea name="content" placeholder="เนื้อเรื่องย่อ..." rows="2" required style={{ minHeight: 60, marginBottom: 8 }} />
                <button type="submit" className="primary sm" style={{ width: "100%" }}>สร้างเรื่องจาก Text</button>
              </form>
            </div>
          </div>
        </div>
      </details>

      {/* Story Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>กำลังโหลดคิวเรื่อง…</div>
      ) : (
        <div className="grid">
          {visibleItems.map((s) => {
            const isSelected = selectedIds.has(s.id);
            const isExpanded = expandedCards.has(s.id);
            const dups = findLikelyDuplicates(s, items);
            const scoreColor = s.viral_score == null ? "var(--muted)" :
                               s.viral_score >= 8 ? "var(--green)" :
                               s.viral_score >= 6 ? "#facc15" : "var(--muted)";

            return (
              <div
                key={s.id}
                className="card"
                style={{
                  borderColor: isSelected ? "var(--indigo)" : undefined,
                  background: isSelected ? "rgba(99, 102, 241, 0.05)" : undefined,
                }}
              >
                {/* Header Row: Checkbox, Badge, Trending, Score */}
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        });
                      }}
                      style={{ width: "auto", cursor: "pointer" }}
                    />
                    <span className={`badge ${s.status}`}>{s.status}</span>
                    {s.trending_tag && (
                      <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-dim)" }}>
                        {s.trending_tag}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: `1px solid ${scoreColor}`,
                      borderRadius: 14,
                      padding: "2px 8px",
                      fontSize: 12,
                      fontWeight: 800,
                      color: scoreColor,
                    }}
                  >
                    ⭐ {s.viral_score != null ? s.viral_score.toFixed(1) : "?"}/10
                  </div>
                </div>

                {/* Title */}
                <h3 style={{ marginBottom: 6 }}>{s.title}</h3>

                {/* Duplicate Warning if any */}
                {dups.length > 0 && (
                  <div style={{ marginBottom: 8, padding: "6px 10px", background: "var(--red-bg)", borderLeft: "3px solid var(--red)", borderRadius: 4, fontSize: 11.5 }}>
                    <span style={{ color: "var(--red)", fontWeight: 700 }}>⚠️ อาจซ้ำกับ: </span>
                    {dups.map(d => d.title).join(", ")}
                  </div>
                )}

                {/* Emotional Hook Preview */}
                {s.emotional_hook && (
                  <div style={{ color: "var(--text-dim)", fontSize: 12.5, fontStyle: "italic", marginBottom: 8 }}>
                    💭 "{s.emotional_hook}"
                  </div>
                )}

                {/* Meta & Expand Details */}
                <div className="row" style={{ justifyContent: "space-between", fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>
                  <span>{s.source} • {new Date(s.created_at).toLocaleDateString()}</span>
                  <button className="btn-subtle sm" onClick={() => toggleCardExpand(s.id)} style={{ padding: 0 }}>
                    {isExpanded ? "ย่อเนื้อหา ▴" : "ดูเนื้อเรื่องย่อ ▾"}
                  </button>
                </div>

                {/* Expanded Section */}
                {isExpanded && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 12.5, color: "var(--text-dim)" }}>
                    {s.content ? (
                      <div style={{ maxHeight: 160, overflowY: "auto", whiteSpace: "pre-wrap", lineHeight: 1.5, marginBottom: 8 }}>
                        {s.content}
                      </div>
                    ) : (
                      <div style={{ fontStyle: "italic", color: "var(--muted)", marginBottom: 8 }}>ไม่มีเนื้อหาบรรยายเพิ่มเติม</div>
                    )}
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "var(--blue)", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        🔗 ดูที่มาต้นฉบับ
                      </a>
                    )}
                  </div>
                )}

                {/* Card Action Buttons */}
                <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
                  <div className="row" style={{ gap: 6 }}>
                    {s.status === "pending" && (
                      <>
                        <button className="success sm" onClick={() => approve(s.id)}>
                          ✓ Approve
                        </button>
                        <button className="btn-outline-danger sm" onClick={() => reject(s.id)}>
                          ✗ Reject
                        </button>
                      </>
                    )}
                    {s.status === "approved" && (
                      <button className="primary sm" onClick={() => approve(s.id)}>
                        🔄 สร้างสคริปต์ใหม่
                      </button>
                    )}
                  </div>

                  <Dropdown
                    trigger={<button className="icon-btn" title="เมนูเพิ่มเติม">⋯</button>}
                    items={[
                      ...(s.url ? [{ label: "เปิดลิงก์ต้นฉบับ", icon: "🔗", onClick: () => window.open(s.url, "_blank") }] : []),
                      { label: "ลบเรื่องนี้ถาวร", icon: "🗑️", danger: true, onClick: () => destroy(s.id) },
                    ]}
                  />
                </div>
              </div>
            );
          })}

          {!visibleItems.length && (
            <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 36, color: "var(--muted)" }}>
              {items.length > 0 && hideLowScore ? (
                <>ทุกเรื่องถูกซ่อนเพราะคะแนนต่ำกว่า {SCORE_THRESHOLD.toFixed(1)} — นำเครื่องหมายออกจาก "ซ่อน &lt; 7.0" เพื่อดูทั้งหมด</>
              ) : (
                <>ยังไม่มีเรื่องในหน้านี้ — กด Scan RSS หรือใช้ AI Classic Finder ด้านบน</>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
