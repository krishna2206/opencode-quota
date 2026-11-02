import { describe, expect, it } from "bun:test";
import { claudeCodeProvider } from "../../src/providers/claude-code/index.js";
import { parseClaudeCodeQuota } from "../../src/providers/claude-code/parse.js";
import { fakeProxy, LOAD } from "../helpers.js";

const window = (remainingPercent: number, resetsAtIso: string | null = "2099-01-01T00:00:00.000Z") => ({
  status: "allowed", utilization: 0, utilizationPercent: 100 - remainingPercent, remainingPercent, resetsAtIso,
});

describe("Claude Code", () => {
  it("matches claude-code-proxy and claude-local", () => {
    expect(claudeCodeProvider.matches({ providerID: "claude-code-proxy" })).toBe(true);
    expect(claudeCodeProvider.matches({ providerID: "claude-local" })).toBe(true);
    expect(claudeCodeProvider.matches({ providerID: "CLAUDE-CODE-PROXY" })).toBe(true);
    expect(claudeCodeProvider.matches({ modelID: "claude-code-proxy/claude-sonnet-5-5" })).toBe(true);
    expect(claudeCodeProvider.matches({ providerID: "antigravity-proxy" })).toBe(false);
    expect(claudeCodeProvider.matches({ providerID: "codex-proxy" })).toBe(false);
    expect(claudeCodeProvider.matches({ providerID: "opencode-go" })).toBe(false);
    expect(claudeCodeProvider.matches({})).toBe(false);
  });

  it("reads the 5h and 7d windows from <url>/api/quota", async () => {
    const urls = fakeProxy(() => Response.json({ status: "ok", fiveHour: window(100), sevenDay: window(89) }));
    const result = await claudeCodeProvider.load({ ...LOAD, model: { providerID: "claude-code-proxy" } });
    expect(urls).toEqual(["http://127.0.0.1:9999/api/quota"]);
    expect(result).toEqual({
      ok: true,
      quotas: [{ kind: "window", windows: [
        { span: "5h", remainingPercent: 100, resetAt: "2099-01-01T00:00:00.000Z" },
        { span: "7d", remainingPercent: 89, resetAt: "2099-01-01T00:00:00.000Z" },
      ] }],
    });
  });

  it("keeps the windows it has and reports an unavailable quota", () => {
    expect(parseClaudeCodeQuota({ status: "ok", fiveHour: null, sevenDay: window(40, null) }))
      .toEqual({ ok: true, quotas: [{ kind: "window", windows: [{ span: "7d", remainingPercent: 40 }] }] });
    expect(parseClaudeCodeQuota({ status: "unavailable" })).toEqual({ ok: false, error: "quota unavailable" });
  });

  it("reports an HTTP error as transient", async () => {
    fakeProxy(() => new Response("boom", { status: 502 }));
    expect(await claudeCodeProvider.load({ ...LOAD, model: {} })).toEqual({ ok: false, error: "proxy error 502", transient: true });
  });
});
