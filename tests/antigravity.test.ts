import { describe, expect, it } from "bun:test";
import type { ProxyStatus } from "../src/providers/antigravity/fetch.js";
import { buildAntigravityEntries, buildPoolEntries } from "../src/providers/antigravity/parse.js";
import { antigravityProvider } from "../src/providers/antigravity/index.js";

const future5h = "2099-10-14T10:00:00.000Z";
const future7d = "2099-10-21T10:00:00.000Z";

describe("Antigravity quota parsing", () => {
  it("emits health-weighted 5h and weekly windows with independent resets", () => {
    const status: ProxyStatus = {
      accounts: [
        {
          email: "healthy@example.com",
          effectiveHealthScore: 100,
          quotaSummary: [{
            displayName: "Gemini Models",
            buckets: [
              { bucketId: "gemini-5h", displayName: "Five Hour", window: "5h", remainingFraction: 0.8, resetTime: future5h },
              { bucketId: "gemini-weekly", displayName: "Weekly", window: "weekly", remainingFraction: 0.6, resetTime: future7d },
            ],
          }],
        },
        {
          email: "unhealthy@example.com",
          effectiveHealthScore: 50,
          quotaSummary: [{
            displayName: "Gemini Models",
            buckets: [
              { bucketId: "gemini-5h", displayName: "Five Hour", window: "5h", remainingFraction: 0.2, resetTime: future5h },
              { bucketId: "gemini-weekly", displayName: "Weekly", window: "weekly", remainingFraction: 0.3, resetTime: future7d },
            ],
          }],
        },
      ],
    };

    const entries = buildAntigravityEntries(status);
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.label)).toEqual(["5h", "7d"]);
    expect(entries[0]?.percentRemaining).toBe(60); // (80*1 + 20*.5) / 1.5
    expect(entries[0]?.resetTimeIso).toBe(future5h);
    expect(entries[1]?.percentRemaining).toBe(50); // (60*1 + 30*.5) / 1.5
    expect(entries[1]?.resetTimeIso).toBe(future7d);
  });

  it("keeps Starter's legacy rolling quota as 5h only", () => {
    const status: ProxyStatus = {
      accounts: [{
        email: "starter@example.com",
        quota: [{ groupName: "Gemini 3.8 Flash", remainingFraction: 0.4, resetTime: future5h }],
      }],
    };

    const entries = buildAntigravityEntries(status);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.label).toBe("5h");
    expect(entries[0]?.percentRemaining).toBe(40);
    expect(entries[0]?.resetTimeIso).toBe(future5h);
  });

  it("ignores Claude/GPT buckets and doesn't invent missing windows", () => {
    const status: ProxyStatus = {
      accounts: [{
        email: "pro@example.com",
        quotaSummary: [
          {
            displayName: "Gemini Models",
            buckets: [{ bucketId: "gemini-5h", displayName: "Five Hour", window: "5h", remainingFraction: 0.9 }],
          },
          {
            displayName: "Claude and GPT models",
            buckets: [
              { bucketId: "3p-5h", displayName: "Five Hour", window: "5h", remainingFraction: 0.1 },
              { bucketId: "3p-weekly", displayName: "Weekly", window: "weekly", remainingFraction: 0.1 },
            ],
          },
        ],
      }],
    };

    const entries = buildAntigravityEntries(status);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.label).toBe("5h");
    expect(entries[0]?.percentRemaining).toBe(90);
  });
});

describe("Antigravity pool behind the session's model", () => {
  const realFetch = globalThis.fetch;
  const serve = (handler: (url: string) => Response) => {
    globalThis.fetch = (async (input: string | URL | Request) => handler(String(input))) as typeof fetch;
  };
  const restore = () => {
    globalThis.fetch = realFetch;
  };

  it("labels a gated pool by its family, Argon with its weekly window only", () => {
    const entries = buildPoolEntries({
      model: "gemini-4-argon-high",
      family: "argon",
      label: "Gemini 4 Argon",
      accounts: 1,
      windows: [{ window: "weekly", remainingPercent: 30, resetTime: future7d }],
    });
    expect(entries).toEqual([{
      kind: "percent",
      name: "Antigravity Gemini 4 Argon 7d",
      group: "Antigravity Gemini 4 Argon",
      label: "7d",
      percentRemaining: 30,
      resetTimeIso: future7d,
    }]);
  });

  it("asks the proxy for the session model's pool", async () => {
    const urls: string[] = [];
    serve((url) => {
      urls.push(url);
      return Response.json({
        model: "claude-sonnet-5-5-high",
        family: "claude",
        label: "Claude",
        accounts: 1,
        windows: [
          { window: "5h", remainingPercent: 50, resetTime: future5h },
          { window: "weekly", remainingPercent: 90, resetTime: future7d },
        ],
      });
    });
    try {
      const result = await antigravityProvider.load({
        requestTimeoutMs: 1_000,
        model: { providerID: "antigravity-proxy", modelID: "antigravity-claude-sonnet-5-5" },
      });
      expect(urls[0]).toContain("/api/quota?model=antigravity-claude-sonnet-5-5");
      expect(result.entries.map((entry) => entry.group)).toEqual(["Antigravity Claude", "Antigravity Claude"]);
      expect(result.entries.map((entry) => entry.percentRemaining)).toEqual([50, 90]);
    } finally {
      restore();
    }
  });

  it("reports a model no account can serve", async () => {
    serve(() => Response.json({ model: "x", family: "claude", label: "Claude", accounts: 0, windows: [] }));
    try {
      const result = await antigravityProvider.load({
        requestTimeoutMs: 1_000,
        model: { providerID: "antigravity-proxy", modelID: "antigravity-claude-opus-5-5" },
      });
      expect(result.entries).toEqual([]);
      expect(result.errors[0]?.message).toBe("No account can serve this model");
    } finally {
      restore();
    }
  });

  it("falls back to /api/status on a proxy without /api/quota", async () => {
    serve((url) => url.includes("/api/quota")
      ? new Response("not found", { status: 404 })
      : Response.json({
        accounts: [{
          email: "a@example.com",
          quotaSummary: [{ displayName: "Gemini Models", buckets: [
            { bucketId: "gemini-5h", displayName: "5h", window: "5h", remainingFraction: 0.4, resetTime: future5h },
          ] }],
        }],
      }));
    try {
      const result = await antigravityProvider.load({
        requestTimeoutMs: 1_000,
        model: { providerID: "antigravity-proxy", modelID: "antigravity-gemini-3.8-flash" },
      });
      expect(result.entries.map((entry) => [entry.group, entry.percentRemaining])).toEqual([["Antigravity", 40]]);
    } finally {
      restore();
    }
  });
});
