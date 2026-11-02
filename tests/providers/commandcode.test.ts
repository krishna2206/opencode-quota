import { describe, expect, it } from "bun:test";
import { commandCodeProvider } from "../../src/providers/commandcode/index.js";
import { parseCommandCodeQuota } from "../../src/providers/commandcode/parse.js";
import { fakeProxy, LOAD } from "../helpers.js";

const cap = (name: string, remainingPercent: number) => ({
  window: name, displayName: name, cap: 0, used: 0, usedPercent: 100 - remainingPercent, remainingPercent,
  status: "allowed", resetsAtIso: null,
});

const account = { id: "a", userName: "u", plan: "individual-go", planDisplayName: "Go ($1/mo)" };

describe("Command Code", () => {
  it("matches commandcode-proxy and commandcode models", () => {
    expect(commandCodeProvider.matches({ providerID: "commandcode-proxy" })).toBe(true);
    expect(commandCodeProvider.matches({ providerID: "commandcode" })).toBe(true);
    expect(commandCodeProvider.matches({ providerID: "COMMANDCODE-PROXY" })).toBe(true);
    expect(commandCodeProvider.matches({ modelID: "commandcode-proxy/commandcode-deepseek-v4.1-flash" })).toBe(true);
    expect(commandCodeProvider.matches({ modelID: "commandcode-deepseek-v4.1-flash" })).toBe(true);
    expect(commandCodeProvider.matches({ modelID: "commandcode-glm-5.2" })).toBe(true);
    expect(commandCodeProvider.matches({ modelID: "commandcode-space-bunny-alpha" })).toBe(true);
    expect(commandCodeProvider.matches({ providerID: "antigravity-proxy" })).toBe(false);
    expect(commandCodeProvider.matches({ providerID: "claude-code-proxy" })).toBe(false);
    expect(commandCodeProvider.matches({ providerID: "codex-proxy" })).toBe(false);
    expect(commandCodeProvider.matches({ providerID: "opencode-go" })).toBe(false);
    expect(commandCodeProvider.matches({})).toBe(false);
  });

  it("shows the USD credit first, then the caps as reported", async () => {
    fakeProxy(() => Response.json({
      status: "ok",
      account,
      credits: { currency: "USD", monthlyAllowance: 10, remaining: 0, used: 10, usedPercent: 100, remainingPercent: 0 },
      fiveHour: cap("5h", 100),
      sevenDay: cap("7d", 100),
    }));
    expect(await commandCodeProvider.load({ ...LOAD, model: { providerID: "commandcode-proxy" } })).toEqual({
      ok: true,
      quotas: [
        { kind: "tokens", usedUsd: 10, allowanceUsd: 10 },
        { kind: "window", windows: [{ span: "5h", remainingPercent: 100 }, { span: "7d", remainingPercent: 100 }] },
      ],
    });
  });

  it("says when no account is connected", () => {
    expect(parseCommandCodeQuota({ status: "ok", account: null })).toEqual({ ok: false, error: "no account connected" });
    expect(parseCommandCodeQuota({ status: "error" })).toEqual({ ok: false, error: "quota unavailable" });
  });
});
