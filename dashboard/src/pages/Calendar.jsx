import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useLanguage } from "../context/LanguageContext.jsx";

// Suggested posting slots tuned for TikTok / Shorts engagement peaks.
const TIME_SLOTS = [
  { id: "s0800", key: "calendar_slot_morning", time: "08:00", icon: "🌅", minutes:  8 * 60 +  0 },
  { id: "s1230", key: "calendar_slot_noon", time: "12:30", icon: "🌞", minutes: 12 * 60 + 30 },
  { id: "s1730", key: "calendar_slot_afternoon", time: "17:30", icon: "🌇", minutes: 17 * 60 + 30 },
  { id: "s2030", key: "calendar_slot_evening", time: "20:30", icon: "🌙", minutes: 20 * 60 + 30 },
  { id: "s2230", key: "calendar_slot_night", time: "22:30", icon: "🌃", minutes: 22 * 60 + 30 },
];

// Niche → category metadata + tier (S/A/B) per ProofEngine RPM ranking.
const NICHE_INFO = {
  // Tier S — double-down (70% of output)
  corporate_disasters:  { label: "🏢 Disasters", tier: "S", color: "#7209b7", bg: "#1a0a2e" },
  scams_fraud:          { label: "💀 Scams",     tier: "S", color: "#b7094c", bg: "#2e0a18" },
  self_justice:         { label: "⚔️ Justice",   tier: "S", color: "#d00000", bg: "#2e0a0a" },
  scammer_payback:      { label: "🎯 Payback",   tier: "S", color: "#6a040f", bg: "#2e0a10" },
  // Tier A — rotate alongside Tier S (25% of output)
  legal_cases:          { label: "⚖️ Legal",     tier: "A", color: "#ff6b35", bg: "#2e1a0a" },
  financial_disasters:  { label: "💰 Finance",   tier: "A", color: "#118ab2", bg: "#0a1a2e" },
  investing_mindset:    { label: "💡 Investing", tier: "A", color: "#023e8a", bg: "#0a1a2e" },
  make_money_online:    { label: "💰 Online Biz", tier: "A", color: "#0077b6", bg: "#0a1a2e" },
  make_money_ai:        { label: "🤖 AI Wealth", tier: "A", color: "#00b4d8", bg: "#0a1a2e" },
  fight_government:     { label: "🏛️ Regulatory", tier: "A", color: "#3d405b", bg: "#1a1a2e" },
  workplace_revenge:    { label: "💼 Workplace",  tier: "A", color: "#582f0e", bg: "#2e1a0a" },
  // Tier B — filler when Tier S has no fresh story (5% of output)
  survival_disaster:    { label: "🌊 Survival",  tier: "B", color: "#06d6a0", bg: "#0a2e1a" },
};
const NICHE_OTHER = { label: "🎬 Other", tier: "?", color: "#888", bg: "#1a1a2e" };

function pad2(n) { return n < 10 ? `0${n}` : `${n}`; }

export function parseBackendTs(ts) {
  if (!ts) return null;
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(ts);
  return new Date(hasTz ? ts : ts + "Z");
}

// Build a dense list of 7 days starting today, in YYYY-MM-DD form.
function nextSevenDays(lang = "en") {
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekdays = lang === "th"
    ? ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      iso: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
      weekday: weekdays[d.getDay()],
      day: d.getDate(),
      isToday: i === 0,
    });
  }
  return out;
}

export function slotForPost(p) {
  const d = parseBackendTs(p.scheduled_at || p.published_at);
  if (!d) return null;
  const minutes = d.getHours() * 60 + d.getMinutes();
  let best = TIME_SLOTS[0];
  let bestDist = Math.abs(minutes - best.minutes);
  for (let i = 1; i < TIME_SLOTS.length; i++) {
    const dist = Math.abs(minutes - TIME_SLOTS[i].minutes);
    if (dist < bestDist) { best = TIME_SLOTS[i]; bestDist = dist; }
  }
  return best.id;
}

export function dateForPost(p) {
  const d = parseBackendTs(p.scheduled_at || p.published_at);
  if (!d) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function Calendar() {
  const { lang, t } = useLanguage();
  const [posts, setPosts] = useState([]);
  const days = useMemo(() => nextSevenDays(lang), [lang]);

  useEffect(() => { api.listPosts().then(setPosts); }, []);

  // Index posts by [date][slot] for O(1) cell lookup.
  const grid = useMemo(() => {
    const g = {};
    for (const p of posts) {
      const d = dateForPost(p);
      const s = slotForPost(p);
      if (!d || !s) continue;
      g[d] ||= {};
      g[d][s] ||= [];
      g[d][s].push(p);
    }
    return g;
  }, [posts]);

  const unscheduled = posts.filter((p) => !p.scheduled_at && !p.published_at);

  return (
    <>
      <div className="page-title">📅 {t("calendar_title", "Content Calendar")}</div>
      <div className="page-sub">
        {t("calendar_sub", "Upcoming 7-day schedule — 5 slots/day optimal algorithmic engagement windows")}
      </div>

      {/* Time-slot legend */}
      <div className="card" style={{ background: "var(--panel2)", marginBottom: 16 }}>
        <div className="row" style={{ flexWrap: "wrap", gap: 16 }}>
          {TIME_SLOTS.map((s) => (
            <div key={s.id} className="row" style={{ gap: 6 }}>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
              <b style={{ fontSize: 13 }}>{t(s.key, s.id)}</b>
              <span className="meta">{s.time}</span>
            </div>
          ))}
          <span className="meta" style={{ marginLeft: "auto" }}>
            {t("calendar_tip", "Consistent posting rhythm helps algorithms discover and pre-cache your content.")}
          </span>
        </div>
      </div>

      {/* 7-day grid: rows = time slots, cols = days */}
      <div className="card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 6, minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ width: 80, color: "#888", fontSize: 11, textAlign: "left", padding: "0 6px" }}></th>
              {days.map((d) => (
                <th key={d.iso} style={{
                  padding: 6, textAlign: "center",
                  background: d.isToday ? "#1a1a2e" : "transparent",
                  borderRadius: 8, color: d.isToday ? "var(--accent)" : "#bbb",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>{d.weekday}</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{d.day}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot) => (
              <tr key={slot.id}>
                <td style={{ padding: 6, color: "#bbb", fontSize: 12, verticalAlign: "top" }}>
                  <div style={{ fontSize: 16 }}>{slot.icon}</div>
                  <div><b>{t(slot.key, slot.id)}</b></div>
                  <div className="meta">{slot.time}</div>
                </td>
                {days.map((d) => {
                  const posts = grid[d.iso]?.[slot.id] || [];
                  return (
                    <td key={d.iso} style={{
                      verticalAlign: "top",
                      background: "var(--panel2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: 6,
                      minHeight: 72,
                      minWidth: 110,
                    }}>
                      {posts.length === 0 ? (
                        <div className="meta" style={{ fontSize: 11, opacity: 0.4, textAlign: "center", padding: "16px 0" }}>
                          {t("calendar_empty_cell", "Empty")}
                        </div>
                      ) : posts.map((p) => {
                        const info = NICHE_INFO[p.niche] || NICHE_OTHER;
                        return (
                          <div key={p.id} style={{
                            background: info.bg,
                            border: `1px solid ${info.color}`,
                            borderRadius: 6, padding: "4px 6px", marginBottom: 4,
                            fontSize: 11,
                          }}>
                            <div className="row" style={{ gap: 4, justifyContent: "space-between" }}>
                              <span style={{ color: info.color, fontWeight: 700 }}>{info.label}</span>
                              <span style={{
                                background: info.color, color: "#fff",
                                fontSize: 9, fontWeight: 800,
                                padding: "1px 5px", borderRadius: 3,
                              }}>
                                {info.tier}
                              </span>
                            </div>
                            <div style={{ color: "#fff", fontWeight: 600, marginTop: 2, lineHeight: 1.2 }}>
                              {p.platform}
                            </div>
                            {p.title && (
                              <div className="meta" style={{
                                fontSize: 10, marginTop: 2, lineHeight: 1.2,
                                overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                                WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                              }}>
                                {p.title}
                              </div>
                            )}
                            <span className={`badge ${p.status}`} style={{ fontSize: 9, marginTop: 4 }}>
                              {p.status}
                            </span>
                          </div>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Unscheduled posts — shown below the grid so they're not lost */}
      {unscheduled.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>⏳ Unscheduled ({unscheduled.length})</h3>
          {unscheduled.map((p) => {
            const info = NICHE_INFO[p.niche] || NICHE_OTHER;
            return (
              <div key={p.id} className="row" style={{ marginTop: 8, justifyContent: "space-between" }}>
                <div className="row" style={{ gap: 6 }}>
                  <span style={{
                    background: info.color, color: "#fff",
                    fontSize: 10, fontWeight: 800,
                    padding: "2px 6px", borderRadius: 3,
                  }}>
                    {info.tier}
                  </span>
                  <span style={{ color: info.color, fontWeight: 700, fontSize: 12 }}>{info.label}</span>
                  <b style={{ marginLeft: 4 }}>{p.platform}</b>
                  {p.title && <span className="meta" style={{ marginLeft: 4 }}>{p.title}</span>}
                </div>
                <span className={`badge ${p.status}`}>{p.status}</span>
              </div>
            );
          })}
        </div>
      )}

      {!posts.length && (
        <div className="meta" style={{ marginTop: 16 }}>
          {lang === "th" ? "ยังไม่มี post — schedule จากหน้า Videos" : "No posts yet — schedule from the Videos tab"}
        </div>
      )}
    </>
  );
}
