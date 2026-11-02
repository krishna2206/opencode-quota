import { describe, expect, it } from "bun:test";
import { zedProvider } from "../../src/providers/zed/index.js";
import { parseZedQuota } from "../../src/providers/zed/parse.js";
import type { ZedQuota } from "../../src/providers/zed/fetch.js";
import { fakeProxy, LOAD } from "../helpers.js";

const credits = (monthlyAllowance: number): NonNullable<ZedQuota["credits"]> => ({
  currency: "USD", monthlyAllowance, usedUsd: 2.45, remainingUsd: 7.55, usedPercent: 24.5, remainingPercent: 75.5,
  renewsAt: "2099-01-04T00:00:00.000Z",
});

describe("Zed", () => {
  it("matches the zed-proxy provider and zed model ids", () => {
    expect(zedProvider.matches({ providerID: "zed-proxy" })).toBe(true);
    expect(zedProvider.matches({ providerID: "ZED" })).toBe(true);
    expect(zedProvider.matches({ modelID: "zed-proxy/claude-sonnet-4-6" })).toBe(true);
    expect(zedProvider.matches({ providerID: "commandcode-proxy" })).toBe(false);
    expect(zedProvider.matches({ providerID: "antigravity-proxy" })).toBe(false);
    expect(zedProvider.matches({ modelID: "claude-sonnet-4-6" })).toBe(false);
    expect(zedProvider.matches({})).toBe(false);
  });

  it("returns the USD spend against the monthly allowance", async () => {
    fakeProxy(() => Response.json({ status: "ok", state: { status: "ok" }, credits: credits(10) }));
    expect(await zedProvider.load({ ...LOAD, model: { providerID: "zed-proxy" } })).toEqual({
      ok: true,
      quotas: [{ kind: "tokens", usedUsd: 2.45, allowanceUsd: 10, resetAt: "2099-01-04T00:00:00.000Z" }],
    });
  });

  it("omits the allowance when the plan has none", () => {
    expect(parseZedQuota({ status: "ok", credits: credits(0) })).toEqual({
      ok: true,
      quotas: [{ kind: "tokens", usedUsd: 2.45, resetAt: "2099-01-04T00:00:00.000Z" }],
    });
  });

  it("asks for a login, or a new account, instead of the spend", () => {
    expect(parseZedQuota({ status: "ok", state: { status: "login_required" }, credits: credits(10) }))
      .toEqual({ ok: false, error: "login required (/zed-login)" });
    expect(parseZedQuota({ status: "ok", state: { status: "exhausted" }, credits: credits(10) }))
      .toEqual({ ok: false, error: "credits exhausted (/zed-login)" });
  });

  it("shows the proxy's message when no account is usable", () => {
    expect(parseZedQuota({ status: "error", message: "no account" })).toEqual({ ok: false, error: "no account" });
    expect(parseZedQuota({ status: "ok", credits: null })).toEqual({ ok: false, error: "no account connected" });
  });
});
