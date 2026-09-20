export const BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
export const API_KEY = import.meta.env.VITE_ENGINE_API_KEY || import.meta.env.VITE_API_KEY || "";

async function j(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (API_KEY) headers["X-API-Key"] = API_KEY;
  const res = await fetch(BASE + path, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed.detail || parsed.message || text;
    } catch {}
    throw new Error(`${res.status} ${detail}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export const api = {
  // niche pack configuration & management
  getActiveNiche: () => j(`/niche/active`),
  listNiches: () => j(`/niche/list`),
  switchNiche: (nicheId) => j(`/niche/switch`, { method: "POST", body: JSON.stringify({ nicheId }) }),

  // stories
  createStory: (payload) => j(`/stories`, { method: "POST", body: JSON.stringify(payload) }),
  listStories: (status, limit = 500) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (limit) params.set("limit", String(limit));
    return j(`/stories?${params.toString()}`);
  },
  getStory: (id) => j(`/stories/${id}`),
  approveStory: (id) => j(`/stories/${id}/approve`, { method: "POST" }),
  rejectStory: (id) => j(`/stories/${id}/reject`, { method: "POST" }),
  deleteStory: (id) => j(`/stories/${id}`, { method: "DELETE" }),
  updateStory: (id, patch) => j(`/stories/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  cleanupRejected: () => j(`/stories/cleanup-rejected`, { method: "POST" }),
  cleanupPending: () => j(`/stories/cleanup-pending`, { method: "POST" }),
  scanStories: () => j(`/stories/scan`, { method: "POST" }),
  findClassicStories: (theme) => j(`/stories/find-classic?theme=${theme}`, { method: "POST" }),

  // scripts
  listScripts: (status) => j(`/scripts${status ? `?status=${status}` : ""}`),
  genScript: (storyId, tone) => j(`/scripts/generate/${storyId}${tone ? `?tone=${tone}` : ""}`, { method: "POST" }),
  genLongScript: (storyId) => j(`/scripts/generate-long/${storyId}`, { method: "POST" }),
  planVisuals: (id, { apply = false, replace = false } = {}) =>
    j(`/scripts/${id}/visual-plan?apply=${apply ? "true" : "false"}&replace=${replace ? "true" : "false"}`, { method: "POST" }),
  updateScript: (id, patch) => j(`/scripts/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  translateEn: (id) => j(`/scripts/${id}/translate-en`, { method: "POST" }),
  regenHook: (id, style) => j(`/scripts/${id}/regen-hook${style ? `?style=${style}` : ""}`, { method: "POST" }),
  regenBody: (id, tone) => j(`/scripts/${id}/regen-body${tone ? `?tone=${tone}` : ""}`, { method: "POST" }),
  shortenScript: (id) => j(`/scripts/${id}/shorten`, { method: "POST" }),
  deleteScript: (id) => j(`/scripts/${id}`, { method: "DELETE" }),
  cleanupErrorScripts: () => j(`/scripts/cleanup-errors`, { method: "POST" }),
  getCaption: (id, platform = "tiktok", lang = "primary") => j(`/scripts/${id}/caption?platform=${platform}&lang=${lang}`),

  // videos
  listVideos: () => j(`/videos`),
  buildVideo: (scriptId, lang = "primary") => j(`/videos/build/${scriptId}?lang=${lang}`, { method: "POST" }),
  buildVideoEn: (scriptId) => j(`/videos/build-en/${scriptId}`, { method: "POST" }),
  getVideo: (id) => j(`/videos/${id}`),
  deleteVideo: (id) => j(`/videos/${id}`, { method: "DELETE" }),
  exportVideoUrl: (id) => `${BASE}/videos/${id}/export`,

  // publish
  schedulePublish: (payload) => j(`/publish`, { method: "POST", body: JSON.stringify(payload) }),
  listPosts: () => j(`/posts`),
  updateExternalId: (postId, externalId) =>
    j(`/posts/${postId}/external-id`, { method: "PATCH", body: JSON.stringify({ external_id: externalId }) }),
  submitManualAnalytics: (postId, payload) =>
    j(`/posts/${postId}/analytics`, { method: "POST", body: JSON.stringify(payload) }),

  // settings
  getSettings: () => j(`/settings`),
  patchSettings: (payload) => j(`/settings`, { method: "PATCH", body: JSON.stringify(payload) }),
};
