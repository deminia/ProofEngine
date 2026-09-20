// Vitest regression for the Calendar TZ-bucketing fix.
//
// Backend writes `scheduled_at` / `published_at` as naive UTC (Python's
// `datetime.utcnow()` → ISO with no zone designator). JS parses naive
// ISO as **local** time, which silently mis-bucketed every post by the
// viewer's TZ offset:
//   * Asia/Bangkok (UTC+7) publish at 19:30 BKK → string "2026-05-10T12:30"
//     → JS parsed as 12:30 BKK local → "noon" slot (wrong: should be evening).
//   * A 19:00-23:59 UTC scheduled_at would even leak into the previous
//     calendar day entirely (e.g. May 10 19:00 UTC = May 11 02:00 BKK).
//
// `parseBackendTs` appends Z when the string is naive so JS treats it as
// UTC, then `.getHours()` / `.getDate()` correctly convert to local time.
// These tests lock in that contract so a future Date refactor can't
// silently break the bucketing again.

import { describe, it, expect } from "vitest";
import { parseBackendTs, slotForPost, dateForPost } from "../Calendar.jsx";

// We can't reliably override the JS runtime TZ inside vitest without
// reloading the worker, so each test computes its expectation against
// the current `Date` instance. The asserts are anchored to
// "what hour does this UTC instant become locally?" — true regardless
// of where the suite happens to run.
function localHourOf(utcIso) {
  return new Date(utcIso).getHours();
}

function localYmdOf(utcIso) {
  const d = new Date(utcIso);
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe("Calendar.parseBackendTs", () => {
  it("interprets naive ISO as UTC, not local", () => {
    // 12:30 UTC. In Asia/Bangkok this is 19:30 — the post should NOT be
    // displayed as if it were 12:30 BKK ("noon" slot). The fix appends Z
    // to the naive string so getHours() reflects the viewer's local zone.
    const naive = "2026-05-10T12:30:00";
    const withZ = "2026-05-10T12:30:00Z";
    expect(parseBackendTs(naive).getTime()).toBe(new Date(withZ).getTime());
  });

  it("leaves explicit-Z and explicit-offset strings unchanged", () => {
    expect(parseBackendTs("2026-05-10T12:30:00Z").getTime())
      .toBe(new Date("2026-05-10T12:30:00Z").getTime());
    expect(parseBackendTs("2026-05-10T19:30:00+07:00").getTime())
      .toBe(new Date("2026-05-10T19:30:00+07:00").getTime());
  });

  it("returns null for falsy input", () => {
    expect(parseBackendTs(null)).toBe(null);
    expect(parseBackendTs(undefined)).toBe(null);
    expect(parseBackendTs("")).toBe(null);
  });
});

describe("Calendar.slotForPost (5-slot bucketing)", () => {
  // Slot centers in minutes-since-midnight, copied from Calendar.jsx so
  // the test fails loudly if a future commit drifts the schedule.
  const SLOTS = [
    { id: "s0800", minutes:  8 * 60 +  0 },
    { id: "s1230", minutes: 12 * 60 + 30 },
    { id: "s1730", minutes: 17 * 60 + 30 },
    { id: "s2030", minutes: 20 * 60 + 30 },
    { id: "s2230", minutes: 22 * 60 + 30 },
  ];

  function expectedSlotForLocalMinutes(minutes) {
    let best = SLOTS[0];
    let bestDist = Math.abs(minutes - best.minutes);
    for (const s of SLOTS.slice(1)) {
      const dist = Math.abs(minutes - s.minutes);
      if (dist < bestDist) { best = s; bestDist = dist; }
    }
    return best.id;
  }

  function expectedSlotForUtcIso(utcIso) {
    const d = new Date(utcIso);
    return expectedSlotForLocalMinutes(d.getHours() * 60 + d.getMinutes());
  }

  it("buckets a 12:30 UTC publish to the closest slot in the viewer's TZ, not the raw UTC hour", () => {
    // Anchored to viewer-local minutes so the assertion is correct in
    // every CI/dev TZ — Bangkok lands this in s2030 (19:30 BKK), UTC
    // lands it in s1230, and slotForPost must agree with whatever the
    // viewer's actual clock reads.
    const post = { scheduled_at: null, published_at: "2026-05-10T12:30:00" };
    expect(slotForPost(post)).toBe(expectedSlotForUtcIso("2026-05-10T12:30:00Z"));
  });

  it("snaps a 17:00 publish to the 17:30 slot, not 12:30", () => {
    // Pre-fix the helper used `if (hour < 17) return 'noon'` which
    // shoved 17:00 into the lunch bucket even though 17:30 is the
    // obviously closer center. We pin that against regression.
    const naive = "2026-05-10T10:00:00";   // 10:00 UTC = 17:00 BKK
    const post = { scheduled_at: naive, published_at: null };
    const minutes = new Date(naive + "Z").getHours() * 60
                  + new Date(naive + "Z").getMinutes();
    expect(slotForPost(post)).toBe(expectedSlotForLocalMinutes(minutes));
  });

  it("snaps 22:30 publish to the late-night slot s2230 (the new 5th slot)", () => {
    const naive = "2026-05-10T15:30:00";   // 15:30 UTC = 22:30 BKK
    const post = { scheduled_at: naive, published_at: null };
    expect(slotForPost(post)).toBe(expectedSlotForUtcIso(naive + "Z"));
  });

  it("prefers scheduled_at when both fields are present", () => {
    // scheduled_at and published_at differ by ~12h so any accidental
    // fallback to published_at would change the slot.
    const post = {
      scheduled_at: "2026-05-10T01:00:00",      // 01 UTC
      published_at: "2026-05-10T13:00:00",      // 13 UTC
    };
    expect(slotForPost(post)).toBe(expectedSlotForUtcIso("2026-05-10T01:00:00Z"));
  });

  it("returns null when neither timestamp is present", () => {
    expect(slotForPost({ scheduled_at: null, published_at: null })).toBe(null);
  });

  it("every slot id used at runtime exists in the schedule (no dead buckets)", () => {
    // Sweep across the day and assert every bucketed result is one of
    // the documented slot ids — guards against a future split that
    // returns "afternoon" or similar by accident.
    const knownIds = new Set(SLOTS.map((s) => s.id));
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30]) {
        const iso = `2026-05-10T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;
        const post = { scheduled_at: iso, published_at: null };
        const slot = slotForPost(post);
        expect(slot).toBeTruthy();
        expect(knownIds.has(slot)).toBe(true);
      }
    }
  });
});

describe("Calendar.dateForPost", () => {
  it("uses the viewer's local calendar day after parsing naive ISO as UTC", () => {
    // 19:00 UTC on May 10 = 02:00 BKK on May 11. The pre-fix `split('T')[0]`
    // would always say "2026-05-10" regardless of the viewer's zone.
    const post = { scheduled_at: "2026-05-10T19:00:00", published_at: null };
    expect(dateForPost(post)).toBe(localYmdOf("2026-05-10T19:00:00Z"));
  });

  it("returns null when neither timestamp is present", () => {
    expect(dateForPost({ scheduled_at: null, published_at: null })).toBe(null);
  });
});
