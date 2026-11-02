import { describe, expect, it } from "bun:test";
import type { ProviderView } from "../src/render/line.js";
import { nextView } from "../src/state/views.js";

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
    expect(nextView(ready, "Antigravity", { ok: false, error: "proxy unreachable", transient: true })).toBe(ready);
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
