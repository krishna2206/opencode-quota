import { describe, expect, it } from "bun:test";
import type { Quota } from "../src/quota/types.js";
import { tone } from "../src/render/colors.js";
import { buildLine, lineText, type CacheStat, type Part, type ProviderView } from "../src/render/line.js";

const CACHE: CacheStat = { inputTokens: 3_480, cacheReadTokens: 40_000 };

function windows(remaining: Partial<Record<"5h" | "7d", number>>): Quota {
  return {
    kind: "window",
    windows: (["5h", "7d"] as const).flatMap((span) =>
      remaining[span] === undefined ? [] : [{ span, remainingPercent: remaining[span]! }]),
  };
}

const ready = (label: string, ...quotas: Quota[]): ProviderView => ({ label, status: "ready", quotas });
const line = (providers: ProviderView[], cache: CacheStat | null = null) => lineText(buildLine(providers, cache));

describe("Status line: golden rendering", () => {
  it("shows used percentages per window", () => {
    expect(line([ready("Antigravity", windows({ "5h": 100, "7d": 89 }))])).toBe("Antigravity · 5h 0% · 7d 11%");
  });

  it("marks a quota whose refresh keeps failing as stale", () => {
    expect(line([{ ...ready("Claude", windows({ "5h": 100, "7d": 97 })), stale: true } as ProviderView]))
      .toBe("Claude · 5h 0% · 7d 3% (stale)");
  });

  it("shows a single window on its own", () => {
    expect(line([ready("Antigravity Gemini 4 Argon", windows({ "7d": 100 }))])).toBe("Antigravity Gemini 4 Argon · 7d 0%");
  });

  it("separates providers with a bar", () => {
    expect(line([ready("Antigravity", windows({ "5h": 71, "7d": 44 })), ready("OpenCode Go", windows({ "5h": 71 }))]))
      .toBe("Antigravity · 5h 29% · 7d 56% | OpenCode Go · 5h 29%");
  });

  it("shows USD spend against the allowance, or alone without one", () => {
    expect(line([ready("Zed", { kind: "tokens", usedUsd: 2.45, allowanceUsd: 10 })])).toBe("Zed · $2.45 / $10.00");
    expect(line([ready("Zed", { kind: "tokens", usedUsd: 2.45 })])).toBe("Zed · $2.45");
  });

  it("never shows a negative amount and keeps two decimals", () => {
    expect(line([ready("Zed", { kind: "tokens", usedUsd: -1, allowanceUsd: 10 })])).toBe("Zed · $0.00 / $10.00");
  });

  it("truncates a line wider than 96 columns with an ellipsis", () => {
    const text = line(["A", "B", "C", "D", "E", "F"].map((name) => ready(`Provider ${name}`, windows({ "5h": 50, "7d": 50 }))));
    expect(text.length).toBe(96);
    expect(text.endsWith("…")).toBe(true);
  });

  it("appends the prompt-cache part of the last step", () => {
    expect(line([ready("Antigravity Claude", windows({ "5h": 100, "7d": 100 }))], CACHE))
      .toBe("Antigravity Claude · 5h 0% · 7d 0% · ⚡92% (40K)");
    expect(line([], { inputTokens: 100, cacheReadTokens: 1_500_000 })).toBe("⚡100% (1.5M)");
    expect(line([], { inputTokens: 500, cacheReadTokens: 1_200 })).toBe("⚡71% (1.2K)");
    expect(line([], { inputTokens: 500, cacheReadTokens: 0 })).toBe("");
  });
});

describe("Status line: what the rewrite changed on purpose", () => {
  it("shows credits as used over the allowance", () => {
    expect(line([ready("Puter", { kind: "credits", used: 0.0011, allowance: 3_000 })])).toBe("Puter · 0 / 3000 cr");
  });

  it("shows Command Code's USD credit before its caps", () => {
    expect(line([ready("CommandCode", { kind: "tokens", usedUsd: 10, allowanceUsd: 10 }, windows({ "5h": 100, "7d": 100 }))]))
      .toBe("CommandCode · $10.00 / $10.00 · 5h 0% · 7d 0%");
  });

  it("names the provider before its error, and still shows the cache", () => {
    expect(line([{ label: "Zed", status: "error", error: "not configured" }], CACHE)).toBe("Zed · not configured · ⚡92% (40K)");
    expect(line([{ label: "Antigravity", status: "error", error: "proxy unreachable" }])).toBe("Antigravity · proxy unreachable");
  });

  it("shows a provider still loading", () => {
    expect(line([{ label: "Claude", status: "loading" }], CACHE)).toBe("Claude · loading… · ⚡92% (40K)");
  });

  it("shows the cache alone for a model without a quota provider", () => {
    expect(line([], CACHE)).toBe("⚡92% (40K)");
  });
});

describe("Status line: colours", () => {
  const part = (p: Part) => tone(p);

  it("colours windows by what remains", () => {
    expect(part({ kind: "window", text: "", remainingPercent: 50 })).toBe("success");
    expect(part({ kind: "window", text: "", remainingPercent: 49 })).toBe("warning");
    expect(part({ kind: "window", text: "", remainingPercent: 19 })).toBe("error");
  });

  it("colours USD spend late: yellow at 80%, red at 95%", () => {
    expect(part({ kind: "tokens", text: "", usedRatio: 0.79 })).toBe("success");
    expect(part({ kind: "tokens", text: "", usedRatio: 0.8 })).toBe("warning");
    expect(part({ kind: "tokens", text: "", usedRatio: 0.95 })).toBe("error");
  });

  it("colours credits by what is used: yellow at 50%, red at 80%", () => {
    expect(part({ kind: "credits", text: "", usedRatio: 0.49 })).toBe("success");
    expect(part({ kind: "credits", text: "", usedRatio: 0.5 })).toBe("warning");
    expect(part({ kind: "credits", text: "", usedRatio: 0.8 })).toBe("error");
  });

  it("colours the cache by its hit ratio, errors red, the rest muted", () => {
    expect(part({ kind: "cache", text: "", hitRatio: 50 })).toBe("success");
    expect(part({ kind: "cache", text: "", hitRatio: 1 })).toBe("warning");
    expect(part({ kind: "cache", text: "", hitRatio: 0 })).toBe("muted");
    expect(part({ kind: "error", text: "" })).toBe("error");
    expect(part({ kind: "label", text: "" })).toBe("muted");
    expect(part({ kind: "pending", text: "" })).toBe("muted");
    expect(part({ kind: "stale", text: "" })).toBe("warning");
  });
});
