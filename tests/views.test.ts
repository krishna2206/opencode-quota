import { describe, expect, it } from "bun:test";
import type { ProviderView } from "../src/render/line.js";
import { nextFailedView, nextView, STALE_AFTER_MS } from "../src/state/views.js";

const ready: ProviderView = {
  label: "Antigravity Claude",
  status: "ready",
  quotas: [{ kind: "window", windows: [{ span: "5h", remainingPercent: 50 }] }],
};

describe("What a result changes on the line", () => {
  it("shows a new quota, with the label the provider chose", () => {
    expect(nextView(undefined, "Antigravity", { ok: true, label: "Antigravity Claude", quotas: [] }))
      .toEqual({ label: "Antigravity Claude", status: "ready", quotas: [] });
  });

  it("keeps the last quota through a transient failure", () => {
    expect(nextView(ready, "Antigravity", { ok: false, error: "proxy unreachable", transient: true }, 1_000))
      .toEqual({ ...ready, failingSince: 1_000, stale: false });
  });

  it("flags the kept quota as stale once failures have lasted long enough", () => {
    const failure = { ok: false, error: "proxy timed out", transient: true } as const;
    const first = nextView(ready, "Antigravity", failure, 1_000);
    const later = nextView(first, "Antigravity", failure, 1_000 + STALE_AFTER_MS - 1);
    expect(later).toMatchObject({ failingSince: 1_000, stale: false });
    const stale = nextView(later, "Antigravity", failure, 1_000 + STALE_AFTER_MS);
    expect(stale).toMatchObject({ failingSince: 1_000, stale: true });
  });

  it("a fresh quota clears the stale flag", () => {
    const stale = nextFailedView(nextFailedView(ready, "A", 0), "A", STALE_AFTER_MS);
    expect(stale).toMatchObject({ stale: true });
    const fresh = nextView(stale, "A", { ok: true, quotas: [] });
    expect(fresh).toEqual({ label: "A", status: "ready", quotas: [] });
  });

  it("an abandoned refresh counts as a transient failure", () => {
    expect(nextFailedView(ready, "Antigravity", 5)).toMatchObject({ status: "ready", failingSince: 5, stale: false });
    expect(nextFailedView(undefined, "Zed", 5)).toMatchObject({ label: "Zed", status: "error" });
  });

  it("shows a transient failure when there is nothing to keep", () => {
    expect(nextView({ label: "Zed", status: "loading" }, "Zed", { ok: false, error: "proxy unreachable", transient: true }))
      .toEqual({ label: "Zed", status: "error", error: "proxy unreachable" });
  });

  it("shows a lasting failure even over a quota", () => {
    expect(nextView(ready, "Antigravity", { ok: false, error: "no account can serve this model" }))
      .toEqual({ label: "Antigravity Claude", status: "error", error: "no account can serve this model" });
  });
});
