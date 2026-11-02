import { describe, expect, it } from "bun:test";
import { antigravityProvider } from "../../src/providers/antigravity/index.js";
import { parsePool } from "../../src/providers/antigravity/parse.js";
import { fakeProxy, LOAD, proxyDown } from "../helpers.js";

const SOON = "2099-01-01T05:00:00Z";
const LATER = "2099-01-07T00:00:00Z";

describe("Antigravity", () => {
  it("matches the antigravity-proxy provider only", () => {
    expect(antigravityProvider.matches({ providerID: "antigravity-proxy", modelID: "antigravity-gemini-4-argon" })).toBe(true);
    expect(antigravityProvider.matches({ providerID: "ANTIGRAVITY-PROXY" })).toBe(true);
    expect(antigravityProvider.matches({ providerID: "claude-code-proxy" })).toBe(false);
    expect(antigravityProvider.matches({})).toBe(false);
  });

  it("asks the proxy for the pool behind the session's model", async () => {
    const urls = fakeProxy(() => Response.json({
      model: "claude-sonnet-5-5-high",
      family: "claude",
      label: "Claude",
      accounts: 1,
      windows: [
        { window: "5h", remainingPercent: 50, resetTime: SOON },
        { window: "weekly", remainingPercent: 90, resetTime: LATER },
      ],
    }));
    const result = await antigravityProvider.load({ ...LOAD, model: { providerID: "antigravity-proxy", modelID: "antigravity-claude-sonnet-5-5" } });
    expect(urls).toEqual(["http://127.0.0.1:9999/api/quota?model=antigravity-claude-sonnet-5-5"]);
    expect(result).toEqual({
      ok: true,
      label: "Antigravity Claude",
      quotas: [{ kind: "window", windows: [
        { span: "5h", remainingPercent: 50, resetAt: SOON },
        { span: "7d", remainingPercent: 90, resetAt: LATER },
      ] }],
    });
  });

  it("names Gemini Flash \"Antigravity\" and keeps Argon's weekly window alone", () => {
    expect(parsePool({ model: "gemini-3.8-flash-high", family: "gemini", label: "Gemini", accounts: 6, windows: [] }))
      .toEqual({ ok: true, label: "Antigravity", quotas: [] });
    expect(parsePool({
      model: "gemini-4-argon-high", family: "argon", label: "Gemini 4 Argon", accounts: 1,
      windows: [{ window: "weekly", remainingPercent: 30 }],
    })).toEqual({
      ok: true,
      label: "Antigravity Gemini 4 Argon",
      quotas: [{ kind: "window", windows: [{ span: "7d", remainingPercent: 30 }] }],
    });
  });

  it("says when no account can serve the model", () => {
    expect(parsePool({ model: "claude-opus-5-5-high", family: "claude", label: "Claude", accounts: 0, windows: [] }))
      .toEqual({ ok: false, error: "no account can serve this model" });
  });

  it("reports a proxy that is down as transient, after retrying", async () => {
    proxyDown();
    const result = await antigravityProvider.load({ ...LOAD, model: { providerID: "antigravity-proxy", modelID: "antigravity-gemini-3.8-flash" } });
    expect(result).toEqual({ ok: false, error: "proxy unreachable", transient: true });
  });
});
