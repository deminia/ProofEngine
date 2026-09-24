import { useEffect, useState } from "react";
import { api, BASE, API_KEY } from "../api";
import { toast } from "../components/Toast.jsx";
import { Dropdown } from "../components/Dropdown.jsx";
import { useNiche } from "../context/NicheContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

function kwToText(json) {
  if (!json) return "";
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.join("\n") : "";
  } catch {
    return "";
  }
}
function kwFromText(text) {
  const lines = (text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return JSON.stringify(lines);
}

const DEFAULT_BEAT_SLOTS = [
  { key: "hook", stage: "HOOK", stageNum: 1, label: "HOOK 1", hint: "Stop the scroll (0-3s)" },
  { key: "setup", stage: "SETUP", stageNum: 2, label: "SETUP 1", hint: "Background and context (3-12s)" },
  { key: "conflict", stage: "CONFLICT", stageNum: 3, label: "CONFLICT 1", hint: "The main conflict or problem (12-25s)" },
  { key: "turning_point", stage: "TURNING", stageNum: 4, label: "TURNING 1", hint: "Climax or turning point (25-40s)" },
  { key: "payoff", stage: "PAYOFF", stageNum: 5, label: "PAYOFF 1", hint: "Resolution and outcome (40-52s)" },
  { key: "cta", stage: "CTA", stageNum: 6, label: "CTA 1", hint: "Call to action and engagement (52-60s)" },
];

function parseSlots(json, beats = DEFAULT_BEAT_SLOTS) {
  const empty = Object.fromEntries(beats.map((b) => [b.key, ""]));
  if (!json) return empty;
  try {
    const parsed = typeof json === "string" ? JSON.parse(json) : json;
    if (!parsed || typeof parsed !== "object") return empty;
    const out = { ...empty };
    for (const b of beats) {
      if (typeof parsed[b.key] === "string") out[b.key] = parsed[b.key];
    }
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && !(k in out)) out[k] = v;
    }
    return out;
  } catch {
    return empty;
  }
}

function serializeSlots(slotsObj, beats = DEFAULT_BEAT_SLOTS) {
  const out = {};
  for (const b of beats) out[b.key] = (slotsObj?.[b.key] || "").trim();
  for (const [k, v] of Object.entries(slotsObj || {})) {
    if (typeof v === "string" && !(k in out)) out[k] = v.trim();
  }
  return JSON.stringify(out);
}

function hasThai(text) {
  return /[\u0E00-\u0E7F]/.test(text || "");
}
function isEnglishQuery(text) {
  return /[A-Za-z]/.test(text || "") && !hasThai(text || "");
}
function titleFromReference(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("wikipedia.org") && u.pathname.includes("/wiki/")) {
      return decodeURIComponent(u.pathname.split("/wiki/").pop()).replace(/_/g, " ").trim();
    }
  } catch {}
  return "";
}

function isYoutubeSlotValue(val) {
  const v = (val || "").trim();
  if (!v || v.toUpperCase() === "__SKIP__") return false;
  const base = v.replace(/^(?:youtube|yt)\s*:\s*/i, "").split("@")[0].trim();
  return /(?:youtube\.com|youtu\.be)/i.test(base);
}

export default function Scripts() {
  const { niche } = useNiche();
  const { lang, t } = useLanguage();
  const activeBeats = (niche?.storyBeats && niche.storyBeats.length > 0)
    ? niche.storyBeats.map((b, idx) => ({
        key: b.id,
        stage: b.id.toUpperCase(),
        stageNum: idx + 1,
        label: `${b.label} (${b.targetSeconds?.[0] || 0}-${b.targetSeconds?.[1] || 0}s)`,
        hint: b.description || "Story beat",
      }))
    : DEFAULT_BEAT_SLOTS;
  const [items, setItems] = useState([]);
  const [stories, setStories] = useState({});
  const [activeTab, setActiveTab] = useState({}); // scriptId -> "narration" | "timeline" | "metadata" | "sources"
  
  // Script edits
  const [edit, setEdit] = useState({});
  const [editKw, setEditKw] = useState({});
  const [editTitle, setEditTitle] = useState({});
  const [editHashtags, setEditHashtags] = useState({});
  const [editDesc, setEditDesc] = useState({});
  const [editAffiliate, setEditAffiliate] = useState({});
  const [editEnglishTitle, setEditEnglishTitle] = useState({});
  const [editCaseImg, setEditCaseImg] = useState({});
  const [editSlots, setEditSlots] = useState({});

  // English Dual-Pipeline state
  const [scriptLangTab, setScriptLangTab] = useState({}); // scriptId -> "th" | "en"
  const [editEnBody, setEditEnBody] = useState({});
  const [editEnTitle, setEditEnTitle] = useState({});
  const [editEnTags, setEditEnTags] = useState({});
  const [translating, setTranslating] = useState({});
  const [buildingEn, setBuildingEn] = useState({});

  const [planningVisuals, setPlanningVisuals] = useState({});
  const [ytClipTest, setYtClipTest] = useState({});

  async function load() {
    const data = await api.listScripts();
    setItems(data);
    const allStories = await api.listStories();
    const map = {};
    for (const st of allStories) map[st.id] = st;
    const missingIds = [...new Set(data.map((s) => s.story_id).filter((id) => id && !map[id]))];
    const missingStories = await Promise.all(
      missingIds.map(async (id) => {
        try { return await api.getStory(id); } catch { return null; }
      })
    );
    for (const st of missingStories) if (st) map[st.id] = st;
    setStories(map);
  }

  useEffect(() => { load(); }, []);

  function patchFor(s) {
    const patch = {};
    if (edit[s.id] !== undefined) patch.body = edit[s.id];
    if (editKw[s.id] !== undefined) patch.visual_keywords = kwFromText(editKw[s.id]);
    if (editTitle[s.id] !== undefined) patch.title_suggestion = editTitle[s.id];
    if (editHashtags[s.id] !== undefined) patch.hashtags = editHashtags[s.id];
    if (editDesc[s.id] !== undefined) patch.description = editDesc[s.id];
    if (editAffiliate[s.id] !== undefined) patch.affiliate_link = editAffiliate[s.id];
    if (editEnBody[s.id] !== undefined) patch.body_en = editEnBody[s.id];
    if (editEnTitle[s.id] !== undefined) patch.title_en = editEnTitle[s.id];
    if (editEnTags[s.id] !== undefined) patch.hashtags_en = editEnTags[s.id];
    return patch;
  }

  function storyPatchFor(s) {
    const storyPatch = {};
    if (editCaseImg[s.story_id] !== undefined) {
      storyPatch.case_image_url = editCaseImg[s.story_id];
    }
    if (editSlots[s.story_id] !== undefined) {
      storyPatch.case_image_slots = serializeSlots(editSlots[s.story_id]);
    }
    if (editEnglishTitle[s.story_id] !== undefined) {
      storyPatch.english_title = (editEnglishTitle[s.story_id] || "").trim();
    }
    return storyPatch;
  }

  function clearEditsForScript(id) {
    setEdit((p) => { const c = { ...p }; delete c[id]; return c; });
    setEditKw((p) => { const c = { ...p }; delete c[id]; return c; });
    setEditTitle((p) => { const c = { ...p }; delete c[id]; return c; });
    setEditHashtags((p) => { const c = { ...p }; delete c[id]; return c; });
    setEditDesc((p) => { const c = { ...p }; delete c[id]; return c; });
    setEditAffiliate((p) => { const c = { ...p }; delete c[id]; return c; });
    setEditEnBody((p) => { const c = { ...p }; delete c[id]; return c; });
    setEditEnTitle((p) => { const c = { ...p }; delete c[id]; return c; });
    setEditEnTags((p) => { const c = { ...p }; delete c[id]; return c; });
  }

  async function save(s) {
    try {
      await api.updateScript(s.id, patchFor(s));
      const storyPatch = storyPatchFor(s);
      if (Object.keys(storyPatch).length) {
        await api.updateStory(s.story_id, storyPatch);
      }
      toast(lang === "th" ? "✓ บันทึกการแก้ไขแล้ว" : "✓ Saved changes");
      clearEditsForScript(s.id);
      load();
    } catch (e) {
      toast("Save error: " + (e.message || e));
    }
  }

  async function approve(s) {
    try {
      await api.updateScript(s.id, { ...patchFor(s), status: "approved" });
      const storyPatch = storyPatchFor(s);
      if (Object.keys(storyPatch).length) {
        await api.updateStory(s.story_id, storyPatch);
      }
      toast(lang === "th" ? "✓ อนุมัติสคริปต์แล้ว — กำลังส่งคิวสร้างวิดีโอ" : "✓ Script approved — queued for video render");
      clearEditsForScript(s.id);
      load();
    } catch (e) {
      toast("Approve error: " + (e.message || e));
    }
  }

  async function reject(s) {
    try {
      await api.updateScript(s.id, { status: "rejected" });
      toast(lang === "th" ? "ปฏิเสธสคริปต์แล้ว" : "Script rejected");
      load();
    } catch (e) {
      toast("Reject error: " + (e.message || e));
    }
  }

  async function rebuild(s) {
    try {
      const patch = patchFor(s);
      if (Object.keys(patch).length) await api.updateScript(s.id, patch);
      const storyPatch = storyPatchFor(s);
      if (Object.keys(storyPatch).length) {
        await api.updateStory(s.story_id, storyPatch);
      }
      await api.buildVideo(s.id);
      toast(lang === "th" ? "🚀 ส่งคิวสร้างวิดีโอใหม่แล้ว…" : "🚀 Queued video rebuild…");
      clearEditsForScript(s.id);
      load();
    } catch (e) {
      const msg = String(e.message || e);
      if (msg.includes("429")) {
        toast(lang === "th" ? "ติด Cooldown 60s: " + msg : "Rate limited (60s cooldown): " + msg);
      } else {
        toast(lang === "th" ? "Rebuild ไม่สำเร็จ: " + msg : "Rebuild failed: " + msg);
      }
    }
  }

  async function destroy(s) {
    if (!confirm(lang === "th" ? `ลบ Script #${s.id} และวิดีโอที่เกี่ยวข้องถาวร?` : `Permanently delete Script #${s.id} and related videos?`)) return;
    await api.deleteScript(s.id);
    toast(lang === "th" ? "ลบสคริปต์แล้ว" : "Script deleted");
    load();
  }

  async function regenerate(s, tone) {
    const toneLabels = { professional: lang === "th" ? "แบบสอน/มืออาชีพ 👔" : "Educational / Professional 👔", finance: lang === "th" ? "แบบ Finance How-to 💰" : "Finance How-to 💰" };
    const toneText = toneLabels[tone] || (lang === "th" ? "แบบปกติ" : "Standard");
    if (!confirm(lang === "th" ? `Regenerate script ${toneText} จาก story #${s.story_id} ใหม่?` : `Regenerate ${toneText} script from story #${s.story_id}?`)) return;
    await api.genScript(s.story_id, tone);
    toast(lang === "th" ? "🔄 กำลังสร้างสคริปต์ใหม่… รอสักครู่" : "🔄 Generating new script… please wait");
    setTimeout(load, 5000);
  }

  async function generateLong(s) {
    if (!confirm(lang === "th" ? `Generate Long-form script (8-12 นาที) จาก story #${s.story_id}?` : `Generate long-form script (8-12 mins) from story #${s.story_id}?`)) return;
    await api.genLongScript(s.story_id);
    toast(lang === "th" ? "📚 กำลังแต่งสคริปต์ยาว 8-12 นาที…" : "📚 Generating long-form script (8-12 mins)…");
    setTimeout(load, 15000);
  }

  async function handleVisualPlan(s, replace = false) {
    try {
      setPlanningVisuals((p) => ({ ...p, [s.id]: true }));
      const res = await api.planVisuals(s.id, { apply: true, replace });
      setEditSlots((p) => {
        const next = { ...p };
        delete next[s.story_id];
        return next;
      });
      const n = Array.isArray(res?.applied) ? res.applied.length : 0;
      toast(lang === "th" ? `✓ วางแผน Footage สำเร็จ: ${n} slots` : `✓ Planned footage for ${n} slots`);
      await load();
    } catch (e) {
      toast("Visual plan failed: " + (e.message || e));
    } finally {
      setPlanningVisuals((p) => ({ ...p, [s.id]: false }));
    }
  }

  async function handleRegenHook(s, style) {
    try {
      setEditTitle((p) => { const n = { ...p }; delete n[s.id]; return n; });
      await api.regenHook(s.id, style);
      toast(lang === "th" ? `🔄 กำลังสร้าง Hook แนว ${style}…` : `🔄 Generating ${style} hook…`);
      setTimeout(load, 4000);
    } catch (e) {
      toast(lang === "th" ? "Regen Hook ไม่สำเร็จ: " + (e.message || e) : "Regen Hook failed: " + (e.message || e));
    }
  }

  async function handleRegenBody(s, tone) {
    try {
      setEdit((p) => { const n = { ...p }; delete n[s.id]; return n; });
      await api.regenBody(s.id, tone);
      toast(lang === "th" ? "🔄 กำลังสร้างเนื้อหา TTS ใหม่…" : "🔄 Generating new narration text…");
      setTimeout(load, 5000);
    } catch (e) {
      toast(lang === "th" ? "Regen Body ไม่สำเร็จ: " + (e.message || e) : "Regen Body failed: " + (e.message || e));
    }
  }

  async function handleShorten(s) {
    if (!confirm(lang === "th" ? "ย่อสคริปต์นี้ให้กระชับขึ้น (~110-150 คำ)?" : "Shorten this script to ~110-150 words?")) return;
    try {
      setEdit((p) => { const n = { ...p }; delete n[s.id]; return n; });
      await api.shortenScript(s.id);
      toast(lang === "th" ? "✂️ กำลังย่อสคริปต์…" : "✂️ Shortening script…");
      setTimeout(load, 5000);
    } catch (e) {
      const msg = e.status === 429 ? (lang === "th" ? "เพิ่งย่อไป รอสักครู่แล้วลองใหม่" : "Cooldown active, please wait") : (e.message || e);
      toast((lang === "th" ? "ย่อสคริปต์ไม่สำเร็จ: " : "Shorten failed: ") + msg);
    }
  }

  async function handleTranslateEn(s) {
    setTranslating((p) => ({ ...p, [s.id]: true }));
    toast(lang === "th" ? "⏳ กำลังแปลเป็นสารคดีภาษาอังกฤษสำหรับช่อง Global..." : "⏳ Translating to English for Global channel...");
    try {
      await api.translateEn(s.id);
      toast(lang === "th" ? "✓ แปลภาษาอังกฤษสำเร็จแล้ว!" : "✓ English translation complete!");
      setScriptLangTab((p) => ({ ...p, [s.id]: "en" }));
      load();
    } catch (e) {
      toast((lang === "th" ? "แปลภาษาอังกฤษไม่สำเร็จ: " : "Translation failed: ") + (e.message || e));
    } finally {
      setTranslating((p) => ({ ...p, [s.id]: false }));
    }
  }

  async function handleBuildEn(s) {
    setBuildingEn((p) => ({ ...p, [s.id]: true }));
    try {
      const patch = patchFor(s);
      if (Object.keys(patch).length) await api.updateScript(s.id, patch);
      const storyPatch = storyPatchFor(s);
      if (Object.keys(storyPatch).length) {
        await api.updateStory(s.story_id, storyPatch);
      }
      await api.buildVideoEn(s.id);
      toast(lang === "th" ? "🚀 เริ่มสร้างวิดีโอภาษาอังกฤษ (Global) แล้ว..." : "🚀 Rendering English Global video...");
      clearEditsForScript(s.id);
      load();
    } catch (e) {
      toast((lang === "th" ? "Build EN ไม่สำเร็จ: " : "Build EN failed: ") + (e.message || e));
    } finally {
      setBuildingEn((p) => ({ ...p, [s.id]: false }));
    }
  }

  async function handleTestYoutubeClip(storyId, beatKey, slotValue) {
    const key = `${storyId}-${beatKey}`;
    setYtClipTest((p) => ({ ...p, [key]: { loading: true } }));
    try {
      const res = await api.testYoutubeClip(slotValue);
      setYtClipTest((p) => ({
        ...p,
        [key]: {
          loading: false,
          mediaUrl: res.media_url,
          start: res.start_seconds,
          duration: res.duration_seconds,
        },
      }));
      toast(lang === "th" ? `ทด clip สำเร็จ (${res.duration_seconds}s)` : `Test clip successful (${res.duration_seconds}s)`);
    } catch (err) {
      setYtClipTest((p) => ({
        ...p,
        [key]: { loading: false, error: err.message || String(err) },
      }));
      toast((lang === "th" ? "ทด clip ไม่สำเร็จ: " : "Test clip failed: ") + (err.message || err));
    }
  }

  return (
    <>
      <div className="page-title">✍️ {t("scripts_title", "Script Review")}</div>
      <div className="page-sub">{t("scripts_sub", "Review, edit, and approve scripts before 9:16 video render.")}</div>

      {/* Top Bar */}
      <div className="row" style={{ marginBottom: 16, justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <button className="secondary sm" onClick={load}>{t("refresh", "🔄 Refresh")}</button>
        <button className="btn-outline-danger sm" onClick={async () => {
          if (!confirm(lang === "th" ? "ลบ Script ที่เป็น (error) หรือถูก reject ทั้งหมดถาวร?" : "Permanently delete all error / rejected scripts?")) return;
          try {
            const res = await api.cleanupErrorScripts();
            toast(lang === "th" ? `ลบไป ${res.removed} เรื่อง` : `Removed ${res.removed} scripts`);
            load();
          } catch (e) {
            toast("Cleanup failed: " + e.message);
          }
        }}>
          {t("scripts_cleanup_error", "🧹 Cleanup Error / Rejected")}
        </button>
      </div>

      {items.map((s) => {
        const story = stories[s.story_id] || {};
        const curTab = activeTab[s.id] || "narration";
        const thBody = edit[s.id] ?? (s.body || "");
        const wordCount = thBody.trim() ? thBody.trim().split(/\s+/).length : 0;
        const estSeconds = Math.round(wordCount / 2.3);

        return (
          <div className="card" key={s.id} style={{ padding: 22 }}>
            
            {/* Header: Title & Hook Tone Selector */}
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
                    {t("scripts_title_hook_label", "🎯 Title & Hook (Video Title and Cover)")}
                  </span>
                  
                  {/* Hook Regen Dropdown */}
                  <Dropdown
                    trigger={<button className="secondary sm" style={{ fontSize: 11, padding: "2px 8px" }}>{t("scripts_change_hook", "🎣 Change Hook Angle ▾")}</button>}
                    items={[
                      { label: lang === "th" ? "😱 แนวช็อก / ดราม่าเข้ม" : "😱 Dramatic / Shock Hook", onClick: () => handleRegenHook(s, "shock") },
                      { label: lang === "th" ? "🤔 แนวตั้งคำถาม / สงสัย" : "🤔 Curiosity / Question Hook", onClick: () => handleRegenHook(s, "curiosity") },
                      { label: lang === "th" ? "⚡ แนวสู้กลับ / พลิกเกม" : "⚡ Turnaround / Payback Hook", onClick: () => handleRegenHook(s, "turnaround") },
                      { label: lang === "th" ? "🔢 แนวลิสต์ / ข้อสรุป" : "🔢 Listicle / Breakdown Hook", onClick: () => handleRegenHook(s, "listicle") },
                    ]}
                  />
                </div>

                <input
                  type="text"
                  value={editTitle[s.id] ?? (s.title_suggestion || "")}
                  placeholder={lang === "th" ? `Script #${s.id} — AI ยังไม่ได้ generate title` : `Script #${s.id} — AI hasn't generated a title yet`}
                  onChange={(e) => setEditTitle((p) => ({ ...p, [s.id]: e.target.value }))}
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    padding: "8px 12px",
                    background: "var(--panel2)",
                    border: "1px solid var(--border)",
                    color: "#fff",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span className={`badge ${s.status}`}>{s.status}</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Script #{s.id} · Story #{s.story_id}</span>
              </div>
            </div>

            {/* 4 Navigation Tabs per Card */}
            <div className="pill-tabs" style={{ marginTop: 14, marginBottom: 16 }}>
              <button
                className={`pill-tab ${curTab === "narration" ? "active" : ""}`}
                onClick={() => setActiveTab((p) => ({ ...p, [s.id]: "narration" }))}
              >
                {t("scripts_tab_narration", "📜 Narration Script")}
              </button>
              <button
                className={`pill-tab ${curTab === "timeline" ? "active" : ""}`}
                onClick={() => setActiveTab((p) => ({ ...p, [s.id]: "timeline" }))}
              >
                {t("scripts_tab_timeline", "🎬 Footage & Story Beats")}
              </button>
              <button
                className={`pill-tab ${curTab === "metadata" ? "active" : ""}`}
                onClick={() => setActiveTab((p) => ({ ...p, [s.id]: "metadata" }))}
              >
                {t("scripts_tab_metadata", "🏷️ Social & Description")}
              </button>
              <button
                className={`pill-tab ${curTab === "sources" ? "active" : ""}`}
                onClick={() => setActiveTab((p) => ({ ...p, [s.id]: "sources" }))}
              >
                {t("scripts_tab_sources", "🔍 Sources (Fact-Check)")}
              </button>
            </div>

            {/* TAB 1: NARRATION SCRIPT (TH & EN) */}
            {curTab === "narration" && (
              <div style={{ background: "var(--panel2)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
                {/* Language Switcher & Fixed Action Bar */}
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
                  <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div className="row" style={{ gap: 4 }}>
                      <button
                        className={`sm ${(scriptLangTab[s.id] || "th") === "th" ? "primary" : "secondary"}`}
                        onClick={() => setScriptLangTab((p) => ({ ...p, [s.id]: "th" }))}
                      >
                        {t("scripts_lang_th", "🇹🇭 Primary Script")}
                      </button>
                      <button
                        className={`sm ${scriptLangTab[s.id] === "en" ? "primary" : "secondary"}`}
                        onClick={() => setScriptLangTab((p) => ({ ...p, [s.id]: "en" }))}
                        style={{ color: (s.body_en || editEnBody[s.id]) ? "#c084fc" : undefined }}
                      >
                        {t("scripts_lang_en", "🌐 English (Global)")} {(s.body_en || editEnBody[s.id]) ? "✓" : ""}
                      </button>
                    </div>

                    {(scriptLangTab[s.id] || "th") === "th" ? (
                      <span className="badge" style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)", fontWeight: 600 }}>
                        ⏱️ ~{wordCount} {lang === "th" ? "คำ" : "words"} (~{estSeconds} {lang === "th" ? "วิ" : "s"})
                      </span>
                    ) : (
                      (s.body_en || editEnBody[s.id]) && (
                        <span style={{ fontSize: 11.5, color: "#c084fc" }}>
                          ✨ Voice: Christopher (Documentary)
                        </span>
                      )
                    )}
                  </div>

                  {/* Fixed Right Actions Cluster */}
                  {(scriptLangTab[s.id] || "th") === "th" ? (
                    <div className="row" style={{ gap: 6, marginLeft: "auto" }}>
                      <button className="secondary sm" onClick={() => handleShorten(s)} title={lang === "th" ? "ย่อสคริปต์ให้กระชับแต่คงประเด็นหลัก" : "Shorten script while keeping key points"}>
                        {t("scripts_shorten", "✂️ Shorten")}
                      </button>
                      <button className="secondary sm" onClick={() => handleRegenBody(s)} title={lang === "th" ? "เขียนบทพากย์ใหม่" : "Regenerate narration body"}>
                        {t("scripts_regen_tts", "🔄 Regen TTS")}
                      </button>
                    </div>
                  ) : (
                    (s.body_en || editEnBody[s.id]) && (
                      <div className="row" style={{ gap: 6, marginLeft: "auto" }}>
                        <button
                          className="secondary sm"
                          onClick={() => handleTranslateEn(s)}
                          disabled={translating[s.id]}
                          style={{ color: "#c084fc" }}
                        >
                          {translating[s.id] ? "⏳ Translating..." : "🔄 AI Re-translate"}
                        </button>
                      </div>
                    )
                  )}
                </div>

                {(scriptLangTab[s.id] || "th") === "th" ? (
                  <textarea
                    value={thBody}
                    onChange={(e) => setEdit((p) => ({ ...p, [s.id]: e.target.value }))}
                    placeholder={lang === "th" ? "เนื้อหาสคริปต์ที่ TTS จะอ่าน..." : "Narration script text for voiceover..."}
                    style={{ minHeight: 140, fontSize: 13.5, lineHeight: 1.6 }}
                  />
                ) : (
                  <div>
                    {(s.body_en || editEnBody[s.id]) ? (
                      <div>
                        <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 700, color: "#d8b4fe" }}>
                          🎬 English Title
                        </div>
                        <input
                          type="text"
                          value={editEnTitle[s.id] !== undefined ? editEnTitle[s.id] : (s.title_en || "")}
                          onChange={(e) => setEditEnTitle((p) => ({ ...p, [s.id]: e.target.value }))}
                          style={{ marginBottom: 10 }}
                        />
                        <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 700, color: "#d8b4fe" }}>
                          📜 English Narration Script (Documentary style)
                        </div>
                        <textarea
                          value={editEnBody[s.id] !== undefined ? editEnBody[s.id] : (s.body_en || "")}
                          onChange={(e) => setEditEnBody((p) => ({ ...p, [s.id]: e.target.value }))}
                          style={{ minHeight: 140, fontSize: 13.5, lineHeight: 1.6 }}
                        />
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: "28px 16px" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#d8b4fe", marginBottom: 6 }}>
                          {lang === "th" ? "🌐 ยังไม่มีสคริปต์เวอร์ชันภาษาอังกฤษ" : "🌐 No English Global Script Yet"}
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--muted)", maxWidth: 460, margin: "0 auto 14px" }}>
                          {lang === "th"
                            ? "กดปุ่มด้านล่างเพื่อให้ AI แปลและเรียบเรียงเป็นสคริปต์สารคดีภาษาอังกฤษสำหรับช่อง Global"
                            : "Click below to translate and adapt into an English documentary script for Global audiences."}
                        </div>
                        <button
                          className="primary sm"
                          onClick={() => handleTranslateEn(s)}
                          disabled={translating[s.id]}
                        >
                          {translating[s.id] ? (lang === "th" ? "⏳ กำลังแปล..." : "⏳ Translating...") : (lang === "th" ? "🌐 แปลเป็นภาษาอังกฤษ (Translate to EN)" : "🌐 Translate to English")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: FOOTAGE & BEATS TIMELINE */}
            {curTab === "timeline" && (() => {
              const storyRow = stories[s.story_id] || {};
              const persisted = parseSlots(storyRow.case_image_slots);
              const current = editSlots[s.story_id] || persisted;
              const updateSlot = (beatKey, val) => {
                setEditSlots((p) => ({
                  ...p,
                  [s.story_id]: { ...(p[s.story_id] || persisted), [beatKey]: val },
                }));
              };

              return (
                <div style={{ background: "var(--panel2)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      💡 {lang === "th"
                        ? "ใส่ YouTube URL (หรือ URL@1:30-2:00) / ไฟล์ภาพ / ai:คีย์เวิร์ด · เว้นว่าง = ระบบ Auto ค้นหาให้"
                        : "YouTube URL (@1:30-2:00), Image URL, or ai:prompt · Blank = Auto Pexels/CC"}
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <button
                        className="secondary sm"
                        onClick={() => handleVisualPlan(s, false)}
                        disabled={!!planningVisuals[s.id]}
                        title={lang === "th" ? "ให้ AI วิเคราะห์สคริปต์และวางแผนภาพในช่องว่าง" : "Let AI analyze script and plan visual slots"}
                      >
                        {planningVisuals[s.id] ? (lang === "th" ? "กำลังวางแผน..." : "Planning...") : "🤖 Auto Visual Plan"}
                      </button>
                      <button
                        className="secondary sm"
                        onClick={() => handleVisualPlan(s, true)}
                        disabled={!!planningVisuals[s.id]}
                        title={lang === "th" ? "ทับทุกช่องด้วยแผนภาพใหม่ของ AI" : "Overwrite all slots with new AI visual plan"}
                      >
                        🔄 {lang === "th" ? "รีเซ็ตและวางแผนใหม่" : "Reset & Re-plan"}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
                    {activeBeats.map((b) => {
                      const val = current[b.key] || "";
                      const isSkipped = val.trim().toUpperCase() === "__SKIP__";
                      const testKey = `${s.story_id}-${b.key}`;
                      const preview = ytClipTest[testKey];

                      return (
                        <div
                          key={b.key}
                          style={{
                            background: isSkipped ? "rgba(239, 68, 68, 0.05)" : "var(--panel3)",
                            border: `1px solid ${isSkipped ? "var(--red-border)" : "var(--border)"}`,
                            borderRadius: 6,
                            padding: "8px 10px",
                          }}
                        >
                          <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--blue)" }}>
                              {b.label}
                            </span>
                            <div className="row" style={{ gap: 4 }}>
                              {isSkipped ? (
                                <button
                                  className="btn-subtle sm"
                                  onClick={() => updateSlot(b.key, "")}
                                  style={{ fontSize: 10, padding: "1px 6px" }}
                                >
                                  🔓 {lang === "th" ? "ปลดล็อค" : "Unlock"}
                                </button>
                              ) : (
                                <button
                                  className="btn-subtle sm"
                                  onClick={() => updateSlot(b.key, "__SKIP__")}
                                  style={{ fontSize: 10, padding: "1px 6px", color: "var(--muted)" }}
                                  title={lang === "th" ? "ข้าม slot นี้ (ใช้ stock แทน)" : "Skip this slot (use stock instead)"}
                                >
                                  🚫 {lang === "th" ? "ข้าม" : "Skip"}
                                </button>
                              )}
                            </div>
                          </div>

                          {isSkipped ? (
                            <div style={{ padding: "6px 8px", background: "var(--red-bg)", borderRadius: 4, color: "var(--red)", fontSize: 11, textAlign: "center" }}>
                              🚫 {lang === "th" ? "ข้ามรูปจริง — ใช้ stock แทน" : "Skip case media — use stock"}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={val}
                              placeholder={lang === "th" ? "YouTube URL@1:30-2:00 / File:... / เว้นว่าง = auto" : "YouTube URL@1:30-2:00 / File URL / Blank = auto"}
                              onChange={(e) => updateSlot(b.key, e.target.value)}
                              style={{ fontFamily: "monospace", fontSize: 11.5, padding: "5px 8px" }}
                            />
                          )}

                          {/* YouTube Clip Preview if tested */}
                          {preview && !preview.error && preview.mediaUrl && (
                            <div style={{ marginTop: 6 }}>
                              <video src={preview.mediaUrl} controls style={{ width: "100%", maxHeight: 140, borderRadius: 4 }} />
                            </div>
                          )}

                          <div className="row" style={{ marginTop: 6, justifyContent: "space-between" }}>
                            <div className="row" style={{ gap: 4 }}>
                              {isYoutubeSlotValue(val) && (
                                <button
                                  type="button"
                                  className="secondary sm"
                                  disabled={ytClipTest[testKey]?.loading}
                                  onClick={() => handleTestYoutubeClip(s.story_id, b.key, val)}
                                  style={{ fontSize: 10.5, padding: "2px 6px" }}
                                >
                                  {ytClipTest[testKey]?.loading ? (lang === "th" ? "กำลังทด..." : "Testing...") : (lang === "th" ? "▶ ทด clip" : "▶ Test clip")}
                                </button>
                              )}
                              
                              <input
                                type="file"
                                accept="image/*,video/mp4"
                                style={{ display: "none" }}
                                id={`upload-${s.id}-${b.key}`}
                                onChange={async (e) => {
                                  const file = e.target.files[0];
                                  if (!file) return;
                                  const formData = new FormData();
                                  formData.append("file", file);
                                  try {
                                    const headers = {};
                                    if (API_KEY) headers["X-API-Key"] = API_KEY;
                                    const r = await fetch(`${BASE}/upload/image`, {
                                      method: "POST",
                                      headers,
                                      body: formData,
                                    });
                                    const res = await r.json();
                                    if (res.url) {
                                      updateSlot(b.key, res.url);
                                      toast(lang === "th" ? "✓ อัปโหลดสำเร็จ" : "✓ Upload successful");
                                    }
                                  } catch (err) {
                                    toast((lang === "th" ? "อัปโหลดไม่สำเร็จ: " : "Upload failed: ") + err.message);
                                  }
                                  e.target.value = "";
                                }}
                              />
                              <label htmlFor={`upload-${s.id}-${b.key}`} style={{ fontSize: 10.5, cursor: "pointer", background: "var(--panel2)", padding: "2px 6px", borderRadius: 4, color: "var(--muted)", border: "1px solid var(--border)" }}>
                                📁 {lang === "th" ? "อัปโหลด" : "Upload"}
                              </label>
                            </div>
                            <span style={{ fontSize: 10, color: "var(--muted)" }}>{b.hint}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* TAB 3: METADATA & SOCIAL */}
            {curTab === "metadata" && (
              <div style={{ background: "var(--panel2)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
                  {/* Left: Description & Affiliate */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
                      📝 {lang === "th" ? "คำอธิบายโพสต์ (Description / Caption พร้อม CTA)" : "Description / Post Caption with CTA"}
                    </div>
                    <textarea
                      value={editDesc[s.id] !== undefined ? editDesc[s.id] : (s.description || "")}
                      onChange={(e) => setEditDesc((p) => ({ ...p, [s.id]: e.target.value }))}
                      placeholder={lang === "th" ? "คำอธิบายโพสต์ 2-3 ประโยค..." : "Post description 2-3 sentences..."}
                      style={{ minHeight: 80, marginBottom: 10 }}
                    />

                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
                      🔗 {lang === "th" ? "ลิงก์ Affiliate (ถ้ามี)" : "Affiliate Link (Optional)"}
                    </div>
                    <input
                      type="text"
                      defaultValue={s.affiliate_link || ""}
                      placeholder="https://..."
                      onChange={(e) => setEditAffiliate((p) => ({ ...p, [s.id]: e.target.value }))}
                    />
                  </div>

                  {/* Right: Hashtags & Visual Keywords */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
                      🏷️ {lang === "th" ? "แฮชแท็ก (#Hashtags)" : "Hashtags (#Hashtags)"}
                    </div>
                    <input
                      type="text"
                      value={editHashtags[s.id] !== undefined ? editHashtags[s.id] : (s.hashtags || "")}
                      onChange={(e) => setEditHashtags((p) => ({ ...p, [s.id]: e.target.value }))}
                      placeholder="#shorts #viral #video"
                      style={{ marginBottom: 10 }}
                    />

                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
                      🎬 {lang === "th" ? "Pexels Visual Keywords (1 ฉากต่อบรรทัด, ภาษาอังกฤษ)" : "Visual Keywords (1 scene per line, English)"}
                    </div>
                    <textarea
                      value={editKw[s.id] !== undefined ? editKw[s.id] : kwToText(s.visual_keywords)}
                      onChange={(e) => setEditKw((p) => ({ ...p, [s.id]: e.target.value }))}
                      placeholder={"courtroom judge gavel\nsad person looking out window"}
                      style={{ minHeight: 80, fontFamily: "monospace", fontSize: 12 }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: FACT-CHECK & SOURCES */}
            {curTab === "sources" && (() => {
              let references = [];
              try {
                if (story.references) {
                  const parsed = JSON.parse(story.references);
                  if (Array.isArray(parsed)) references = parsed.filter(u => typeof u === "string" && u.startsWith("http"));
                }
              } catch {}
              if (references.length === 0 && story.url) references = [story.url];

              const englishTitle = (editEnglishTitle[s.story_id] ?? story.english_title ?? "").trim();
              const englishQueryRaw = [
                englishTitle,
                ...references.map(titleFromReference),
                story.url ? titleFromReference(story.url) : "",
                isEnglishQuery(story.title) ? story.title : "",
                isEnglishQuery(s.title_suggestion) ? s.title_suggestion : "",
              ].find(isEnglishQuery) || "";
              const searchQuery = englishQueryRaw ? encodeURIComponent(englishQueryRaw) : "";

              return (
                <div style={{ background: "var(--panel2)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>
                    📚 {lang === "th" ? "แหล่งข้อมูลที่อ้างอิง:" : "References & Sources:"}
                  </div>
                  <div className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {references.length > 0 ? (
                      references.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 12,
                            padding: "3px 10px",
                            background: "var(--panel3)",
                            border: "1px solid var(--border)",
                            borderRadius: 4,
                            color: "var(--blue)",
                          }}
                        >
                          🔗 {url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 32)}...
                        </a>
                      ))
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--amber)" }}>
                        ⚠️ {lang === "th" ? "ยังไม่มีข้อมูลอ้างอิงชัดเจน" : "No clear references recorded"}
                      </span>
                    )}
                  </div>

                  <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 240px" }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
                        {lang === "th" ? "คำค้นหาภาษาอังกฤษ (Fact-check Query):" : "Fact-Check English Query:"}
                      </div>
                      <input
                        type="text"
                        value={editEnglishTitle[s.story_id] ?? story.english_title ?? ""}
                        placeholder="e.g. Case Topic"
                        onChange={(e) => setEditEnglishTitle((p) => ({ ...p, [s.story_id]: e.target.value }))}
                        style={{ fontSize: 12, padding: "5px 8px" }}
                      />
                    </div>

                    {searchQuery && (
                      <div className="row" style={{ gap: 6, paddingTop: 14 }}>
                        <a href={`https://en.wikipedia.org/w/index.php?search=${searchQuery}`} target="_blank" rel="noreferrer" className="btn secondary sm">
                          📖 Wikipedia
                        </a>
                        <a href={`https://news.google.com/search?q=${searchQuery}`} target="_blank" rel="noreferrer" className="btn secondary sm">
                          🗞️ Google News
                        </a>
                        <a href={`https://www.google.com/search?q=${searchQuery}&tbm=isch`} target="_blank" rel="noreferrer" className="btn secondary sm">
                          🖼️ Google Images
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Bottom Action Bar — Consolidated & Clean */}
            <div className="row" style={{ marginTop: 16, justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                {s.status === "draft" ? (
                  <button className="success" onClick={() => approve(s)}>
                    ✓ Approve → Build Video
                  </button>
                ) : (
                  <button className="success" onClick={() => rebuild(s)}>
                    🔨 Rebuild Video
                  </button>
                )}
                
                <button className="secondary" onClick={() => save(s)}>
                  {t("scripts_save_btn", "💾 Save Changes")}
                </button>

                {/* Unified Regen Dropdown */}
                <Dropdown
                  trigger={<button className="secondary">{t("scripts_regen_dropdown", "🔄 Regen Script ▾")}</button>}
                  items={[
                    { label: lang === "th" ? "🔄 Regen Short (ทั่วไป)" : "🔄 Regen Standard Short", onClick: () => regenerate(s) },
                    { label: lang === "th" ? "👔 Regen โทนมืออาชีพ / สอน" : "👔 Regen Educational / Professional", onClick: () => regenerate(s, "professional") },
                    { label: lang === "th" ? "💰 Regen โทน Finance How-to" : "💰 Regen Finance How-to", onClick: () => regenerate(s, "finance") },
                    { label: lang === "th" ? "📚 Gen Long-form (8-12 นาที)" : "📚 Gen Long-form (8-12 mins)", onClick: () => generateLong(s) },
                    { divider: true },
                    { label: lang === "th" ? "🎙️ Regen TTS Body เท่านั้น" : "🎙️ Regen TTS Narration Only", onClick: () => handleRegenBody(s) },
                    { label: lang === "th" ? "✂️ ย่อสคริปต์ให้กระชับลง" : "✂️ Shorten Script", onClick: () => handleShorten(s) },
                  ]}
                />
              </div>

              {/* More Actions Dropdown */}
              <Dropdown
                trigger={<button className="icon-btn" title={t("more_options", "⋯ More")}>⋯</button>}
                items={[
                  { label: lang === "th" ? "🌐 แปลสคริปต์ภาษาอังกฤษ (EN)" : "🌐 Translate to English (EN)", icon: "🌐", onClick: () => handleTranslateEn(s) },
                  { label: lang === "th" ? "🚀 Build EN Video (Global)" : "🚀 Build EN Video (Global)", icon: "🎬", onClick: () => handleBuildEn(s) },
                  { divider: true },
                  ...(s.status === "draft" ? [{ label: lang === "th" ? "✗ ปฏิเสธสคริปต์ (Reject)" : "✗ Reject Script", icon: "✗", onClick: () => reject(s) }] : []),
                  { label: lang === "th" ? "🗑️ ลบสคริปต์นี้ถาวร" : "🗑️ Delete Script Permanently", icon: "🗑️", danger: true, onClick: () => destroy(s) },
                ]}
              />
            </div>

          </div>
        );
      })}

      {!items.length && (
        <div className="card" style={{ textAlign: "center", padding: 36, color: "var(--muted)" }}>
          {t("scripts_empty", "No scripts yet — approve stories in Story Queue first")}
        </div>
      )}
    </>
  );
}
