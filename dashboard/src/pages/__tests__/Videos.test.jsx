// Frontend unit tests for `publishImmediately` / `scheduleForLater`.
//
// These lock in the contract established by the spec
// `publish-now-schedules-to-1230` task 3.1:
//   1. Publish now ALWAYS sends `scheduled_at: null` — stale datetime
//      input state must never leak into the payload.
//   2. Schedule sends the parsed datetime as a UTC ISO string.
//   3. Schedule is disabled until a datetime is entered.
//   4. Both handlers clear `schedAt[v.id]` in `finally`, so a success
//      OR a thrown error from the API never leaves the input poisoned
//      for the next click.
//   5. Toast copy differentiates the two actions (Schedule/Scheduled
//      wording is reserved for the schedule path).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the api module the component imports as `../api`. From this test
// file that same module resolves via `../../api` — vitest normalises
// both to the same module id so the mock intercepts the component's
// import.
vi.mock("../../api", () => ({
  api: {
    listVideos: vi.fn(),
    listPosts: vi.fn(),
    listScripts: vi.fn().mockResolvedValue([]),
    schedulePublish: vi.fn(),
    deleteVideo: vi.fn(),
    buildVideo: vi.fn(),
    exportVideoUrl: vi.fn(() => "http://stub/export"),
    getCaption: vi.fn(),
    updatePost: vi.fn(),
    addManualAnalytics: vi.fn(),
  },
}));

// Toast is a module-level singleton (see components/Toast.jsx); mock
// the `toast` export so we can assert on call args without needing a
// real <ToastHost /> mounted in the test tree.
vi.mock("../../components/Toast.jsx", () => ({
  toast: vi.fn(),
}));

import Videos from "../Videos.jsx";
import { api } from "../../api";
import { toast } from "../../components/Toast.jsx";

const VIDEO_FIXTURE = {
  id: 1,
  script_id: 10,
  status: "done",
  video_path: "video/foo.mp4",
  progress: 100,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.listVideos.mockResolvedValue([VIDEO_FIXTURE]);
  api.listPosts.mockResolvedValue([]);
  api.listScripts.mockResolvedValue([]);
  api.schedulePublish.mockResolvedValue({ ok: true, post_ids: [1] });
});

afterEach(() => {
  cleanup();
});

// Render the component and wait for the async `load()` in its
// useEffect to resolve and paint the Publish / Schedule buttons. All
// tests below this point can assume the done-state controls are in
// the DOM.
async function renderAndWait() {
  const utils = render(<Videos />);
  await screen.findByRole("button", { name: "📤 Publish now" });
  return utils;
}

// Helper: locate the single datetime-local input for the one rendered
// video. React Testing Library doesn't have a first-class role query
// for `type=datetime-local`, so we fall back to a DOM selector — there
// is exactly one of these in the fixture tree.
function getSchedInput(container) {
  const input = container.querySelector('input[type="datetime-local"]');
  if (!input) throw new Error("datetime-local input not found");
  return input;
}

describe("Videos — publishImmediately / scheduleForLater", () => {
  it("publishImmediately sends { scheduled_at: null } regardless of schedAt[v.id] state", async () => {
    const user = userEvent.setup();
    const { container } = await renderAndWait();

    // Simulate the exact booby-trap the fix is guarding against: an
    // old datetime sitting in the input from a prior interaction.
    const input = getSchedInput(container);
    fireEvent.change(input, { target: { value: "2026-05-14T19:30" } });
    expect(input).toHaveValue("2026-05-14T19:30");

    await user.click(screen.getByRole("button", { name: "▶️ YouTube" }));
    await user.click(screen.getByRole("button", { name: "📤 Publish now" }));

    await waitFor(() => {
      expect(api.schedulePublish).toHaveBeenCalledWith({
        video_id: 1,
        platforms: ["youtube"],
        scheduled_at: null,
      });
    });
  });

  it("scheduleForLater sends correct UTC ISO when datetime is entered", async () => {
    const user = userEvent.setup();
    const { container } = await renderAndWait();

    fireEvent.change(getSchedInput(container), {
      target: { value: "2026-05-14T19:30" },
    });

    await user.click(screen.getByRole("button", { name: "▶️ YouTube" }));
    await user.click(screen.getByRole("button", { name: "⏳ Schedule" }));

    // Compute the expected ISO the same way the handler does, so the
    // assertion is robust to the test runner's local timezone (UTC in
    // CI, Asia/Bangkok on some local machines).
    const expectedIso = new Date("2026-05-14T19:30").toISOString();
    await waitFor(() => {
      expect(api.schedulePublish).toHaveBeenCalledWith({
        video_id: 1,
        platforms: ["youtube"],
        scheduled_at: expectedIso,
      });
    });
  });

  it("Schedule button is disabled when schedAt[v.id] is empty", async () => {
    await renderAndWait();
    expect(screen.getByRole("button", { name: "⏳ Schedule" })).toBeDisabled();
  });

  it("schedAt[v.id] is cleared after successful publishImmediately", async () => {
    const user = userEvent.setup();
    const { container } = await renderAndWait();

    const input = getSchedInput(container);
    fireEvent.change(input, { target: { value: "2026-05-14T19:30" } });
    expect(input).toHaveValue("2026-05-14T19:30");

    await user.click(screen.getByRole("button", { name: "▶️ YouTube" }));
    await user.click(screen.getByRole("button", { name: "📤 Publish now" }));

    await waitFor(() => expect(api.schedulePublish).toHaveBeenCalled());
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("schedAt[v.id] is cleared after failed publishImmediately", async () => {
    // Force the API to throw so we exercise the `finally` branch of
    // the handler — the input must still be cleared.
    api.schedulePublish.mockRejectedValueOnce(new Error("boom"));

    const user = userEvent.setup();
    const { container } = await renderAndWait();

    const input = getSchedInput(container);
    fireEvent.change(input, { target: { value: "2026-05-14T19:30" } });
    expect(input).toHaveValue("2026-05-14T19:30");

    await user.click(screen.getByRole("button", { name: "▶️ YouTube" }));
    await user.click(screen.getByRole("button", { name: "📤 Publish now" }));

    await waitFor(() => expect(api.schedulePublish).toHaveBeenCalled());
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it('toast copy for publishImmediately does not contain the word "Scheduled"', async () => {
    const user = userEvent.setup();
    await renderAndWait();

    await user.click(screen.getByRole("button", { name: "▶️ YouTube" }));
    await user.click(screen.getByRole("button", { name: "📤 Publish now" }));

    await waitFor(() => expect(api.schedulePublish).toHaveBeenCalled());
    await waitFor(() => expect(toast).toHaveBeenCalled());

    for (const call of toast.mock.calls) {
      expect(String(call[0])).not.toMatch(/Scheduled/);
    }
  });

  it('toast copy for scheduleForLater contains "Scheduled"', async () => {
    const user = userEvent.setup();
    const { container } = await renderAndWait();

    fireEvent.change(getSchedInput(container), {
      target: { value: "2026-05-14T19:30" },
    });

    await user.click(screen.getByRole("button", { name: "▶️ YouTube" }));
    await user.click(screen.getByRole("button", { name: "⏳ Schedule" }));

    await waitFor(() => expect(api.schedulePublish).toHaveBeenCalled());
    await waitFor(() => {
      const hasScheduled = toast.mock.calls.some((c) => /Scheduled/.test(String(c[0])));
      expect(hasScheduled).toBe(true);
    });
  });
});
