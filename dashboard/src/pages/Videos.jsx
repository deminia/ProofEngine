import { useEffect, useState } from "react";
import { api } from "../api";
import { useNiche } from "../context/NicheContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { toast } from "../components/Toast.jsx";
import { Dropdown } from "../components/Dropdown.jsx";

const PLATFORMS = [
  { id: "youtube", label: "▶️ YouTube" },
  { id: "tiktok", label: "🎵 TikTok" },
  { id: "instagram", label: "📷 Instagram" },
  { id: "facebook", label: "👥 Facebook" },
  { id: "shopee", label: "🛒 Shopee Video" },
  { id: "x", label: "𝕏 X (Twitter)" },
];

const MANUAL_PLATFORMS = new Set(["tiktok", "instagram", "facebook", "x"]);

function resolveMediaUrl(dbPath) {
  if (!dbPath) return "";
  if (dbPath.startsWith("http://") || dbPath.startsWith("https://")) {
    return dbPath;
  }
  return `/media/${dbPath.split("media/").pop()}`;
}

export default function Videos() {
  const { niche } = useNiche();
  const { lang, t } = useLanguage();
  const activePlatforms = niche?.publishing?.platforms || ["tiktok", "youtube", "instagram", "facebook", "x"];
  const captionKeys = Object.keys(niche?.social?.captionTemplates || { tiktok: "", youtube: "", facebook: "", x: "" });
  const [items, setItems] = useState([]);
  const [scripts, setScripts] = useState({});
  const [sel, setSel] = useState({});
  const [posts, setPosts] = useState([]);
  const [captionModal, setCaptionModal] = useState(null);
  const [schedAt, setSchedAt] = useState({});
  const [statsForm, setStatsForm] = useState({});
  const [editPostId, setEditPostId] = useState({});
  const [logModal, setLogModal] = useState(null);
  const [activeTab, setActiveTab] = useState("shorts");
  const [showSched, setShowSched] = useState({});

  async function load() {
    const [vids, ps, scrData] = await Promise.all([api.listVideos(), api.listPosts(), api.listScripts()]);
    setItems(vids);
    setPosts(ps);
    const sMap = {};
    for (const s of scrData) sMap[s.id] = s;
    setScripts(sMap);
  }

  useEffect(() => {
    setSchedAt({});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  function togglePlat(vid, id) {
    setSel((p) => {
      const cur = p[vid] || [];
      return { ...p, [vid]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });
  }

  async function publishImmediately(v) {
    const plats = sel[v.id] || [];
    if (!plats.length) return toast(lang === "th" ? "เลือก platform อย่างน้อย 1" : "Select at least 1 platform");
    try {
      await api.schedulePublish({ video_id: v.id, platforms: plats, scheduled_at: null });
      toast("📤 Publishing now");
    } catch (e) {
      toast(lang === "th" ? "Publish ไม่สำเร็จ: " + (e.message || e) : "Publish failed: " + (e.message || e));
    } finally {
      setSchedAt((p) => ({ ...p, [v.id]: undefined }));
    }
  }

  async function scheduleForLater(v) {
    const plats = sel[v.id] || [];
    if (!plats.length) return toast(lang === "th" ? "เลือก platform อย่างน้อย 1" : "Select at least 1 platform");
    const dt = schedAt[v.id];
    if (!dt) return toast(lang === "th" ? "ใส่วันเวลาในช่องก่อนกด Schedule" : "Please set date and time before scheduling");
    const parsed = new Date(dt);
    if (isNaN(parsed.getTime())) return toast(lang === "th" ? "วันเวลาไม่ถูกต้อง — โปรดใส่ใหม่" : "Invalid date/time format");
    try {
      await api.schedulePublish({
        video_id: v.id,
        platforms: plats,
        scheduled_at: parsed.toISOString(),
      });
      toast(`⏳ Scheduled for ${dt}`);
    } catch (e) {
      toast(lang === "th" ? "Schedule ไม่สำเร็จ: " + (e.message || e) : "Schedule failed: " + (e.message || e));
    } finally {
      setSchedAt((p) => ({ ...p, [v.id]: undefined }));
    }
  }

  async function remove(v) {
    if (!confirm(lang === "th" ? `ลบ Video #${v.id}?` : `Delete Video #${v.id}?`)) return;
    await api.deleteVideo(v.id);
    toast(lang === "th" ? `ลบ Video #${v.id} แล้ว` : `Deleted Video #${v.id}`);
    load();
  }

  async function viewLog(v) {
    try {
      const data = await api.getVideoLog(v.id);
      setLogModal({ video_id: v.id, content: data.content || "(empty)" });
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg.includes("404")) {
        toast(lang === "th" ? "ยังไม่มี ffmpeg log สำหรับวิดีโอนี้" : "No ffmpeg log for this video yet");
      } else {
        toast(lang === "th" ? "ดึง log ไม่สำเร็จ: " + msg : "Failed to fetch log: " + msg);
      }
    }
  }

  async function retry(v) {
    try {
      await api.buildVideo(v.script_id, v.language || "th");
      toast("Rebuilding…");
      load();
    } catch (e) {
      const msg = String(e.message || e);
      if (msg.includes("429")) {
        toast("Rebuild rate-limited (60s/script): " + msg);
      } else {
        toast(lang === "th" ? "Rebuild ไม่สำเร็จ: " + msg : "Rebuild failed: " + msg);
      }
    }
  }

  function exportForCapcut(v) {
    const a = document.createElement("a");
    a.href = api.exportVideoUrl(v.id);
    a.download = `video_${v.id}_capcut.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(lang === "th" ? "📦 Exporting ZIP… รอสักครู่" : "📦 Exporting ZIP… please wait");
  }

  async function showCaption(v, platform) {
    if (platform === "x_thread") {
      toast(lang === "th" ? "⏳ AI กำลังเขียน Thread ให้แบบมืออาชีพ (รอประมาณ 10-15 วิ)..." : "⏳ AI generating professional thread (10-15s)...");
    }
    try {
      const data = await api.getCaption(v.script_id, platform, v.language || "th");
      setCaptionModal({ ...data, video_id: v.id });
    } catch (e) {
      toast(lang === "th" ? "ดึง caption ไม่ได้: " + e.message : "Failed to fetch caption: " + e.message);
    }
  }

  async function copyCaption() {
    if (!captionModal) return;
    try {
      await navigator.clipboard.writeText(captionModal.caption);
      toast(lang === "th" ? "📋 คัดลอกแล้ว — นำไปวางในแอปได้เลย" : "📋 Copied to clipboard");
    } catch {
      toast(lang === "th" ? "คัดลอกไม่สำเร็จ — เลือกข้อความเองด้านล่าง" : "Copy failed — select text manually below");
    }
  }

  async function copyFirstComment() {
    if (!captionModal?.first_comment) return;
    try {
      await navigator.clipboard.writeText(captionModal.first_comment);
      toast(lang === "th" ? "📋 คัดลอก first-comment แล้ว — วางใต้โพสต์ได้เลย" : "📋 Copied first comment to clipboard");
    } catch {
      toast(lang === "th" ? "คัดลอกไม่สำเร็จ" : "Copy failed");
    }
  }

  function postsForVideo(vid) {
    return posts.filter((p) => p.video_id === vid);
  }

  async function saveExternalId(post) {
    const v = editPostId[post.id];
    if (!v) return;
    await api.updatePost(post.id, { external_id: v });
    toast(lang === "th" ? "เซฟ ID แล้ว" : "Saved ID");
    setEditPostId((m) => ({ ...m, [post.id]: undefined }));
    load();
  }

  async function saveStats(post) {
    const f = statsForm[post.id] || {};
    await api.addManualAnalytics(post.id, {
      views: parseInt(f.views || 0, 10) || 0,
      likes: parseInt(f.likes || 0, 10) || 0,
      comments: parseInt(f.comments || 0, 10) || 0,
      shares: parseInt(f.shares || 0, 10) || 0,
    });
    toast(lang === "th" ? "เซฟ stats แล้ว" : "Saved stats");
    setStatsForm((m) => ({ ...m, [post.id]: {} }));
  }

  return (
    <>
      <div className="page-title">🎬 {t("videos_title", "Videos")}</div>
      <div className="page-sub">{t("videos_sub", "Review rendered videos, select target platforms, and publish or schedule.")}</div>

      {/* Type Filter Tabs */}
      <div className="pill-tabs" style={{ marginBottom: 20 }}>
        <button className={`pill-tab ${activeTab === "shorts" ? "active" : ""}`} onClick={() => setActiveTab("shorts")}>
          {t("videos_tab_shorts", "📱 Shorts (Primary)")}
        </button>
        <button className={`pill-tab ${activeTab === "en" ? "active" : ""}`} onClick={() => setActiveTab("en")}>
          {t("videos_tab_global", "🌐 Global (EN)")}
        </button>
        <button className={`pill-tab ${activeTab === "long" ? "active" : ""}`} onClick={() => setActiveTab("long")}>
          {t("videos_tab_long", "🖥️ Long Form")}
        </button>
        <button className={`pill-tab ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")}>
          {t("videos_tab_all", "🎬 All")}
        </button>
      </div>

      <div className="grid">
        {items.filter(v => {
          const s = scripts[v.script_id];
          const isLong = Boolean((s?.title_suggestion || "").includes("[LONG FORM]") || (s?.title_suggestion || "").includes("[EXTENDED]"));
          if (activeTab === "long") return isLong;
          if (activeTab === "en") return v.language === "en";
          if (activeTab === "shorts") return !isLong && v.language !== "en";
          return true;
        }).map((v) => {
          const vidPosts = postsForVideo(v.id);
          const manualPosts = vidPosts.filter((p) => MANUAL_PLATFORMS.has(p.platform));
          const isSelectedAnyPlat = (sel[v.id] || []).length > 0;

          return (
            <div className="card" key={v.id}>
              
              {/* Header: Title & Badges */}
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <div className="row" style={{ gap: 8 }}>
                  <h3 style={{ margin: 0 }}>Video #{v.id}</h3>
                  {v.language === "en" ? (
                    <span className="badge" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.3)" }}>
                      🌐 Global EN
                    </span>
                  ) : (
                    <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
                      {lang === "th" ? "🇹🇭 Thai" : "Primary (TH)"}
                    </span>
                  )}
                </div>
                <span className={`badge ${v.status}`}>{v.status}</span>
              </div>

              <div className="meta" style={{ marginBottom: 12 }}>
                Script #{v.script_id}
                {scripts[v.script_id]?.title_suggestion && (
                  <span style={{ marginLeft: 6, color: "var(--text-dim)", fontWeight: 500 }}>
                    · {scripts[v.script_id].title_suggestion.slice(0, 42)}...
                  </span>
                )}
              </div>

              {/* Video Player */}
              {v.video_path && (
                <div style={{ marginBottom: 12, textAlign: "center" }}>
                  <video src={resolveMediaUrl(v.video_path)} preload="none" controls className="video-player" />
                </div>
              )}

              {/* Rendering Progress */}
              {v.status === "rendering" && (
                <div style={{ margin: "14px 0" }}>
                  <div style={{ background: "var(--panel2)", borderRadius: 8, overflow: "hidden", height: 8, border: "1px solid var(--border)" }}>
                    <div style={{ width: `${v.progress}%`, background: "linear-gradient(90deg, var(--indigo), var(--blue))", height: "100%", transition: "width 0.3s ease" }} />
                  </div>
                  <div className="row" style={{ justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                    <span>{t("videos_rendering", "Rendering video...")}</span>
                    <span>{v.progress}%</span>
                  </div>
                  <div className="row" style={{ marginTop: 10, gap: 8 }}>
                    <button className="secondary sm" onClick={() => retry(v)}>🔄 Force Retry</button>
                    <button className="btn-outline-danger sm" onClick={() => remove(v)}>🗑️ Delete Stuck</button>
                  </div>
                </div>
              )}

              {/* Ready / Done State Controls */}
              {v.status === "done" && (
                <div>
                  {/* Platform Selection Badges */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>
                      {t("videos_target_plat", "Target Platforms:")}
                    </div>
                    <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                      {PLATFORMS.map((p) => {
                        const isChosen = (sel[v.id] || []).includes(p.id);
                        const isPublished = vidPosts.some((post) => post.platform === p.id && (post.status === "published" || post.external_id));
                        return (
                          <button
                            key={p.id}
                            className={`sm ${isChosen ? "primary" : "secondary"}`}
                            onClick={() => togglePlat(v.id, p.id)}
                            style={{
                              padding: "4px 10px",
                              borderColor: isChosen ? "var(--indigo)" : undefined,
                              opacity: isPublished ? 1 : isChosen ? 1 : 0.7,
                            }}
                          >
                            <span>{p.label}</span>
                            {isPublished && (
                              <span style={{ fontSize: 9.5, background: "var(--green-bg)", color: "var(--green)", padding: "1px 5px", borderRadius: 4, marginLeft: 4, fontWeight: 700 }}>
                                {t("videos_published_badge", "✓ Published")}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Primary Actions: Publish Now & Collapsible Schedule Drawer */}
                  <div style={{ background: "var(--panel2)", padding: 10, borderRadius: 8, border: "1px solid var(--border)", marginBottom: 12 }}>
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <button
                        className="success sm"
                        onClick={() => publishImmediately(v)}
                        disabled={!isSelectedAnyPlat}
                        title={isSelectedAnyPlat ? (lang === "th" ? "เผยแพร่ไปยังแพลตฟอร์มที่เลือกทันที" : "Publish to selected platforms immediately") : (lang === "th" ? "โปรดเลือกแพลตฟอร์มก่อน" : "Please select platforms first")}
                        style={{ padding: "6px 16px", fontWeight: 700 }}
                      >
                        📤 Publish now
                      </button>

                      <button
                        type="button"
                        className="btn-subtle sm"
                        onClick={() => setShowSched(prev => ({ ...prev, [v.id]: !prev[v.id] }))}
                        style={{ fontSize: 11.5, color: "var(--muted)", textDecoration: "underline", padding: "2px 6px" }}
                      >
                        {showSched[v.id] || schedAt[v.id] ? t("videos_schedule_hide", "▴ Hide schedule") : t("videos_schedule_show", "⏳ Schedule for later...")}
                      </button>
                    </div>

                    {/* Collapsible schedule drawer */}
                    <div className={`schedule-drawer ${(showSched[v.id] || schedAt[v.id]) ? "expanded" : "collapsed"}`}>
                      <div className="row" style={{ gap: 6, paddingTop: 8, borderTop: "1px dashed var(--border)", alignItems: "center" }}>
                        <input
                          type="datetime-local"
                          value={schedAt[v.id] || ""}
                          onChange={(e) => setSchedAt((p) => ({ ...p, [v.id]: e.target.value }))}
                          style={{ fontSize: 11.5, padding: "4px 8px", maxWidth: 210 }}
                          title={lang === "th" ? "ใส่วันเวลาสำหรับตั้งเวลาโพสต์" : "Choose date and time to schedule"}
                        />
                        <button
                          className="secondary sm"
                          onClick={() => scheduleForLater(v)}
                          disabled={!schedAt[v.id] || !isSelectedAnyPlat}
                          title={lang === "th" ? "ใส่วันเวลาและเลือกแพลตฟอร์มก่อนกด" : "Select platform and date/time first"}
                        >
                          {t("videos_schedule", "⏳ Schedule")}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Captions & Secondary Tools */}
                  <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    {/* Single Clean Copy Caption Dropdown */}
                    <Dropdown
                      trigger={<button className="secondary sm">{t("videos_copy_caption", "📋 Copy Caption ▾")}</button>}
                      items={captionKeys.map((k) => ({
                        label: `📋 ${k.toUpperCase()} Caption`,
                        onClick: () => showCaption(v, k),
                      }))}
                    />

                    {/* Secondary Actions Dropdown */}
                    <Dropdown
                      trigger={<button className="icon-btn" title={t("videos_menu_more", "⋯ More")}>⋯</button>}
                      items={[
                        { label: t("videos_export_capcut", "🎬 Export for CapCut (ZIP)"), icon: "📦", onClick: () => exportForCapcut(v) },
                        { label: t("videos_rebuild", "🔄 Rebuild Video"), icon: "🔨", onClick: () => retry(v) },
                        { label: t("videos_view_log", "📜 View ffmpeg log"), icon: "📜", onClick: () => viewLog(v) },
                        { divider: true },
                        { label: t("videos_delete", "🗑️ Delete Video"), icon: "🗑️", danger: true, onClick: () => remove(v) },
                      ]}
                    />
                  </div>
                </div>
              )}

              {/* Manual Upload Tracking — Collapsible to save space */}
              {manualPosts.length > 0 && (
                <details className="custom-accordion" style={{ marginTop: 12, marginBottom: 0 }}>
                  <summary style={{ padding: "8px 12px", fontSize: 12 }}>
                    <span>{t("videos_manual_upload", "📊 Manual Upload Tracking")} ({manualPosts.length} {lang === "th" ? "แพลตฟอร์ม" : "platforms"})</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("open", "Open ▾")}</span>
                  </summary>
                  <div className="accordion-body" style={{ padding: 12 }}>
                    {manualPosts.map((p) => (
                      <div key={p.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px dashed var(--border)" }}>
                        <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{p.platform}</span>
                          <code style={{ fontSize: 11, color: "var(--muted)" }}>{p.external_id || (lang === "th" ? "(ยังไม่มี ID)" : "(No ID yet)")}</code>
                        </div>
                        <div className="row" style={{ gap: 6, marginBottom: 6 }}>
                          <input
                            type="text"
                            placeholder={lang === "th" ? "วางโพสต์ URL หรือ Video ID..." : "Paste post URL or Video ID..."}
                            value={editPostId[p.id] || ""}
                            onChange={(e) => setEditPostId((m) => ({ ...m, [p.id]: e.target.value }))}
                            style={{ fontSize: 11.5, padding: "3px 6px" }}
                          />
                          <button className="secondary sm" onClick={() => saveExternalId(p)}>{t("videos_save_id", "💾 Save ID")}</button>
                        </div>
                        <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                          {["views", "likes", "comments", "shares"].map((k) => (
                            <input
                              key={k}
                              type="number"
                              placeholder={k}
                              value={(statsForm[p.id] || {})[k] || ""}
                              onChange={(e) => setStatsForm((m) => ({
                                ...m,
                                [p.id]: { ...(m[p.id] || {}), [k]: e.target.value },
                              }))}
                              style={{ width: 64, fontSize: 11.5, padding: "3px 6px" }}
                            />
                          ))}
                          <button className="success sm" onClick={() => saveStats(p)}>+ Stats</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Error Display */}
              {v.error && (
                <div style={{ color: "var(--red)", marginTop: 8, fontSize: 12, background: "var(--red-bg)", padding: 8, borderRadius: 6, whiteSpace: "pre-wrap" }}>
                  ⚠️ {v.error}
                </div>
              )}

              {/* Failed State Action Buttons */}
              {v.status === "failed" && (
                <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="success sm" onClick={() => retry(v)}>{lang === "th" ? "🔄 ลองใหม่ (Retry)" : "🔄 Retry"}</button>
                    <button className="secondary sm" onClick={() => viewLog(v)}>{t("videos_view_log", "📜 View ffmpeg log")}</button>
                  </div>
                  <button className="btn-outline-danger sm" onClick={() => remove(v)}>{lang === "th" ? "🗑️ ลบ" : "🗑️ Delete"}</button>
                </div>
              )}
            </div>
          );
        })}

        {!items.length && (
          <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 36, color: "var(--muted)" }}>
            {t("videos_empty", "No videos rendered yet — approve a script in the Scripts tab first")}
          </div>
        )}
      </div>

      {/* Caption Preview Modal */}
      {captionModal && (() => {
        const platInfo = (() => {
          const p = captionModal.platform;
          if (p === "youtube") return { name: "YouTube", icon: "▶️", url: "https://studio.youtube.com/" };
          if (p === "instagram") return { name: "Instagram", icon: "📷", url: "https://www.instagram.com/" };
          if (p === "facebook") return { name: "Facebook", icon: "👥", url: "https://business.facebook.com/" };
          if (p === "shopee") return { name: "Shopee Video", icon: "🛒", url: "https://seller.shopee.co.th/" };
          if (p === "x" || p === "x_thread") return { name: "X (Twitter)", icon: "𝕏", url: "https://twitter.com/compose/tweet" };
          return { name: "TikTok", icon: "🎵", url: "https://www.tiktok.com/upload" };
        })();

        return (
          <div
            onClick={() => setCaptionModal(null)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1000, padding: 20, backdropFilter: "blur(4px)",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "var(--panel)", padding: 22, borderRadius: 12,
                maxWidth: 620, width: "100%", maxHeight: "90vh", overflow: "auto",
                border: "1px solid var(--border)",
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>📋 {lang === "th" ? `Caption สำหรับ ${platInfo.name}` : `Caption for ${platInfo.name}`}</h3>
                <button className="btn-subtle sm" onClick={() => setCaptionModal(null)}>✕</button>
              </div>

              <div className="meta" style={{ marginBottom: 10 }}>
                {captionModal.char_count} {lang === "th" ? "ตัวอักษร" : "characters"} — niche: {captionModal.niche}
              </div>

              {/* Sanity Warnings if any */}
              {Array.isArray(captionModal.warnings) && captionModal.warnings.length > 0 && (
                <div
                  style={{
                    background: "var(--amber-bg)",
                    border: "1px solid var(--amber-border)",
                    color: "var(--amber)",
                    padding: 10,
                    borderRadius: 8,
                    marginBottom: 12,
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    ⚠️ {lang === "th" ? `ตรวจสอบข้อความก่อนโพสต์ (พบ ${captionModal.warnings.length} จุดน่าสงสัย):` : `Review before posting (${captionModal.warnings.length} warnings):`}
                  </div>
                  <ul style={{ margin: "4px 0 0 18px" }}>
                    {captionModal.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cover Preview */}
              {captionModal.cover_url && (
                <div style={{ marginBottom: 14, background: "var(--panel2)", padding: 10, borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    🖼️ {lang === "th" ? "รูปหน้าปก (Cover Image)" : "Cover Image"}
                  </div>
                  <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                    <a href={captionModal.cover_url} target="_blank" rel="noopener noreferrer" title={lang === "th" ? "คลิกเปิดเต็มจอเพื่อดาวน์โหลด" : "Click to view full image to download"}>
                      <img
                        src={captionModal.cover_url}
                        alt="cover"
                        style={{ width: 85, height: 150, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }}
                      />
                    </a>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6 }}>
                      {lang === "th" ? (
                        <>
                          ขนาด 1080×1920 สำหรับ {platInfo.name}<br/>
                          1. คลิกที่รูปเพื่อเปิดภาพขนาดเต็ม<br/>
                          2. คลิกขวา → บันทึกรูปภาพ (Save Image)<br/>
                          3. อัปโหลดเป็นหน้าปกใน {platInfo.name} Studio
                        </>
                      ) : (
                        <>
                          1080×1920 portrait for {platInfo.name}<br/>
                          1. Click image to open full resolution<br/>
                          2. Right-click → Save image<br/>
                          3. Upload as cover in {platInfo.name} Studio
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Caption Textarea */}
              <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 700 }}>
                ✏️ {lang === "th" ? "เนื้อหา Caption (แก้ไขได้):" : "Caption Text (Editable):"}
              </div>
              <textarea
                value={captionModal.caption}
                onChange={(e) =>
                  setCaptionModal((m) => (m ? { ...m, caption: e.target.value } : m))
                }
                style={{ minHeight: 140, fontSize: 13.5, lineHeight: 1.5, marginBottom: 12 }}
              />

              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <button className="success" onClick={copyCaption}>
                  {lang === "th" ? "📋 คัดลอก Caption" : "📋 Copy Caption"}
                </button>
                <a href={platInfo.url} target="_blank" rel="noopener noreferrer">
                  <button className="secondary">
                    {platInfo.icon} {lang === "th" ? `เปิด ${platInfo.name} Studio` : `Open ${platInfo.name} Studio`}
                  </button>
                </a>
              </div>

              {/* First Comment if available */}
              {captionModal.first_comment && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    💬 {lang === "th" ? "First comment (สำหรับวางเป็นคอมเมนต์แรก — เครดิตรูปภาพ):" : "First comment (pin as top comment for media credits):"}
                  </div>
                  <textarea
                    readOnly
                    value={captionModal.first_comment}
                    style={{ minHeight: 80, fontSize: 12, color: "var(--muted)", marginBottom: 8 }}
                  />
                  <button className="secondary sm" onClick={copyFirstComment}>
                    {lang === "th" ? "📋 คัดลอก First-comment" : "📋 Copy First Comment"}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ffmpeg Log Modal */}
      {logModal && (
        <div
          onClick={() => setLogModal(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--panel)", borderRadius: 12, padding: 18,
              maxWidth: 900, width: "100%", maxHeight: "85vh",
              display: "flex", flexDirection: "column", border: "1px solid var(--border)",
            }}
          >
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>📜 ffmpeg log — Video #{logModal.video_id}</h3>
              <button className="btn-subtle sm" onClick={() => setLogModal(null)}>✕</button>
            </div>
            <pre style={{
              flex: 1, overflow: "auto", margin: 0, padding: 12,
              background: "var(--panel2)", color: "#e2e8f0",
              fontSize: 11, lineHeight: 1.4,
              border: "1px solid var(--border)", borderRadius: 6,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>{logModal.content}</pre>
            <div className="row" style={{ marginTop: 10, justifyContent: "flex-end" }}>
              <button
                className="secondary sm"
                onClick={() => {
                  navigator.clipboard.writeText(logModal.content);
                  toast(lang === "th" ? "คัดลอก log แล้ว" : "Log copied to clipboard");
                }}
              >
                📋 Copy log
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
