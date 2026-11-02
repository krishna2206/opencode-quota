import { describe, expect, it } from "bun:test";
import { puterProvider } from "../../src/providers/puter/index.js";
import { parsePuterQuota } from "../../src/providers/puter/parse.js";
import { fakeProxy, LOAD } from "../helpers.js";

describe("Puter", () => {
  it("matches Puter models only", () => {
    expect(puterProvider.matches({ providerID: "puter" })).toBe(true);
    expect(puterProvider.matches({ providerID: "opencode-puter" })).toBe(true);
    expect(puterProvider.matches({ modelID: "puter/gpt-6-luna" })).toBe(true);
    expect(puterProvider.matches({ providerID: "zed-proxy" })).toBe(false);
    expect(puterProvider.matches({})).toBe(false);
  });

  it("returns the credits used over the monthly allowance", async () => {
    const urls = fakeProxy(() => Response.json({
      status: "ok",
      credits: { unit: "credits", monthlyAllowance: 1000, remaining: 695, used: 305, usedPercent: 30.5, resetsAt: "2099-02-01T00:00:00.000Z" },
    }));
    expect(await puterProvider.load({ ...LOAD, model: { providerID: "puter" } })).toEqual({
      ok: true,
      quotas: [{ kind: "credits", used: 305, allowance: 1000, resetAt: "2099-02-01T00:00:00.000Z" }],
    });
    expect(urls).toEqual(["http://127.0.0.1:9999/api/quota"]);
  });

  it("reports a missing allowance and the proxy's own errors", () => {
    expect(parsePuterQuota({ status: "ok" })).toEqual({ ok: false, error: "credit allowance missing" });
    expect(parsePuterQuota({ status: "error", message: "all accounts cooling down" }))
      .toEqual({ ok: false, error: "all accounts cooling down" });
  });
});
