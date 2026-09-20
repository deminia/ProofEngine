import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

// Suggested posting slots tuned for Thai TikTok / Shorts engagement peaks.
// Five posts/day aligns with TikTok's "publish often, publish on rhythm"
// algorithmic guidance — same slot every day teaches the FYP when your
// audience is active so it can pre-cache distribution.
//   08:00 — morning commute (BTS/MRT scroll)
//   12:30 — lunch break (max FYP push)
//   17:30 — after-work / dinner prep window
//   20:30 — prime evening (couch/bed scroll, 20-22 is the peak hour)
//   22:30 — late-night scroll (still strong on TH FYP)
//
// `minutes` is the slot center in minutes-since-midnight; slotForPost
// snaps each post to the closest center so every minute of the day maps
// to exactly one slot without dead zones or off-by-one boundaries.
const TIME_SLOTS = [
  { id: "s0800", label: "เช้า",   time: "08:00", icon: "🌅", minutes:  8 * 60 +  0 },
  { id: "s1230", label: "เที่ยง", time: "12:30", icon: "🌞", minutes: 12 * 60 + 30 },
  { id: "s1730", label: "บ่าย",   time: "17:30", icon: "🌇", minutes: 17 * 60 + 30 },
  { id: "s2030", label: "ค่ำ",    time: "20:30", icon: "🌙", minutes: 20 * 60 + 30 },
  { id: "s2230", label: "ดึก",    time: "22:30", icon: "🌃", minutes: 22 * 60 + 30 },
];

// Niche → category metadata + tier (S/A/B) per ProofEngine RPM ranking.
// Keep these slugs in sync with app.tasks._niche_from_source(). Anything
// not listed falls into "other". true_crime is intentionally absent —
// demonetization risk pushed it out of the active rotation.
const NICHE_INFO = {
  // Tier S — double-down (70% of output)
  corporate_disasters:  { label: "🏢 องค์กรล่ม", tier: "S", color: "#7209b7", bg: "#1a0a2e" },
  scams_fraud:          { label: "💀 สแกม",      tier: "S", color: "#b7094c", bg: "#2e0a18" },
  self_justice:         { label: "⚔️ แก้แค้นเอง", tier: "S", color: "#d00000", bg: "#2e0a0a" },
  scammer_payback:      { label: "🎯 ต้มตุ๋นคืน",  tier: "S", color: "#6a040f", bg: "#2e0a10" },
  // Tier A — rotate alongside Tier S (25% of output)
  legal_cases:          { label: "⚖️ คดีกฎหมาย", tier: "A", color: "#ff6b35", bg: "#2e1a0a" },
  financial_disasters:  { label: "💰 การเงิน",   tier: "A", color: "#118ab2", bg: "#0a1a2e" },
  investing_mindset:    { label: "💡 ออมเงิน/ลงทุน", tier: "A", color: "#023e8a", bg: "#0a1a2e" },
  make_money_online:    { label: "💰 หาเงินออนไลน์", tier: "A", color: "#0077b6", bg: "#0a1a2e" },
  make_money_ai:        { label: "🤖 รวยด้วย AI", tier: "A", color: "#00b4d8", bg: "#0a1a2e" },
  fight_government:     { label: "🏛️ สู้กับรัฐ",  tier: "A", color: "#3d405b", bg: "#1a1a2e" },
  workplace_revenge:    { label: "💼 แก้แค้นบอส", tier: "A", color: "#582f0e", bg: "#2e1a0a" },
  // Tier B — filler when Tier S has no fresh story (5% of output)
  survival_disaster:    { label: "🌊 ภัยพิบัติ",  tier: "B", color: "#06d6a0", bg: "#0a2e1a" },
};
const NICHE_OTHER = { label: "🎬 อื่นๆ", tier: "?", color: "#888", bg: "#1a1a2e" };

function pad2(n) { return n < 10 ? `0${n}` : `${n}`; }

// The backend stores `scheduled_at` / `published_at` as naive UTC
// (datetime.utcnow() → ISO string with no timezone designator). When JS
// parses an ISO string without `Z`, it treats it as **local** time —
// dropping the +07:00 offset and silently mis-bucketing every post by
// 7 hours. A 19:30 BKK publish appears as 19:30 UTC = 12:30 BKK ("noon")
// or, if the publish was anywhere from 17:00–06:59 BKK, it leaks into
// the wrong day entirely. Append `Z` so the string is parsed as UTC and
// `.getHours()` / `.getDate()` then convert to the viewer's local zone.
export function parseBackendTs(ts) {
  if (!ts) return null;
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(ts);
  return new Date(hasTz ? ts : ts + "Z");
}

// Build a dense list of 7 days starting today, in YYYY-MM-DD form.
function nextSevenDays() {
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      iso: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
      weekday: ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"][d.getDay()],
      day: d.getDate(),
      isToday: i === 0,
    });
  }
  return out;
}

// Map a post's scheduled_at / published_at to its closest TIME_SLOTS entry.
// Posts without either timestamp are treated as "unscheduled" by the caller.
//
// We snap by minutes-since-midnight rather than by hour bands because the
// slot centers (12:30, 17:30, 20:30, 22:30) all sit on half-hour marks,
// and a hour-only check would shove a 17:00 publish into the "12:30" bucket
// even though 17:30 is the obviously correct slot.
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
  const [posts, setPosts] = useState([]);
  const days = useMemo(nextSevenDays, []);

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
      <div className="page-title">📅 Content Calendar</div>
      <div className="page-sub">
        Schedule 7 วันถัดไป — 5 slot/วัน (08:00 / 12:30 / 17:30 / 20:30 / 22:30 — peak engagement TikTok TH)
      </div>

      {/* Time-slot legend */}
      <div className="card" style={{ background: "var(--panel2)", marginBottom: 16 }}>
        <div className="row" style={{ flexWrap: "wrap", gap: 16 }}>
          {TIME_SLOTS.map((s) => (
            <div key={s.id} className="row" style={{ gap: 6 }}>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
              <b style={{ fontSize: 13 }}>{s.label}</b>
              <span className="meta">{s.time}</span>
            </div>
          ))}
          <span className="meta" style={{ marginLeft: "auto" }}>
            ทำให้เป็นเวลาประจำเพื่อให้ algorithm รู้จัก audience ของคุณ
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
                  <div><b>{slot.label}</b></div>
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
                          ว่าง
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
          ยังไม่มี post — schedule จากหน้า Videos
        </div>
      )}
    </>
  );
}
