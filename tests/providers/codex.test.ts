import { describe, expect, it } from "bun:test";
import { codexProvider } from "../../src/providers/codex/index.js";
import { parseCodexQuota } from "../../src/providers/codex/parse.js";
import { fakeProxy, LOAD } from "../helpers.js";

const window = (name: string, remainingPercent: number) => ({
  window: name, displayName: name, status: "allowed", utilization: 0, utilizationPercent: 100 - remainingPercent,
  remainingPercent, remainingFraction: remainingPercent / 100, resetsAtIso: null, contributingAccounts: 2,
});

describe("Codex", () => {
  it("matches codex-proxy and codex models", () => {
    expect(codexProvider.matches({ providerID: "codex-proxy" })).toBe(true);
    expect(codexProvider.matches({ providerID: "codex" })).toBe(true);
    expect(codexProvider.matches({ providerID: "CODEX-PROXY" })).toBe(true);
    expect(codexProvider.matches({ modelID: "codex-proxy/codex-gpt-6-astra" })).toBe(true);
    expect(codexProvider.matches({ modelID: "codex-gpt-6-astra" })).toBe(true);
    expect(codexProvider.matches({ modelID: "codex-gpt-5.5" })).toBe(true);
    expect(codexProvider.matches({ providerID: "antigravity-proxy" })).toBe(false);
    expect(codexProvider.matches({ providerID: "claude-code-proxy" })).toBe(false);
    expect(codexProvider.matches({ providerID: "opencode-go" })).toBe(false);
    expect(codexProvider.matches({})).toBe(false);
  });

  it("passes the pool computed by codex-proxy through", async () => {
    fakeProxy(() => Response.json({ status: "ok", accountsCount: 2, fiveHour: window("5h", 65), sevenDay: window("7d", 75) }));
    expect(await codexProvider.load({ ...LOAD, model: { providerID: "codex-proxy" } })).toEqual({
      ok: true,
      quotas: [{ kind: "window", windows: [{ span: "5h", remainingPercent: 65 }, { span: "7d", remainingPercent: 75 }] }],
    });
  });

  it("says when no account is connected", () => {
    expect(parseCodexQuota({ status: "ok", accountsCount: 0 })).toEqual({ ok: false, error: "no account connected" });
    expect(parseCodexQuota({ status: "unavailable" })).toEqual({ ok: false, error: "quota unavailable" });
  });
});
