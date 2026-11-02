import { describe, expect, it } from "bun:test";
import { buildCompactLine, formatSessionCachePart } from "../src/hud/compact.js";
import type { QuotaEntry } from "../src/providers/types.js";

const RESET = "2099-01-01T00:00:00.000Z";

function windows(group: string, remaining: Partial<Record<"5h" | "7d", number>>): QuotaEntry[] {
  return (["5h", "7d"] as const).flatMap((label) =>
    remaining[label] === undefined
      ? []
      : [{ kind: "percent" as const, name: `${group} ${label}`, group, label, percentRemaining: remaining[label]!, resetTimeIso: RESET }],
  );
}

function line(entries: QuotaEntry[]): string {
  return buildCompactLine({ entries, errors: [] }).text;
}

describe("Compact line: golden rendering", () => {
  it("shows used percentages per window", () => {
    expect(line(windows("Antigravity", { "5h": 100, "7d": 89 }))).toBe("Antigravity · 5h 0% · 7d 11%");
  });

  it("shows a single window on its own", () => {
    expect(line(windows("Antigravity Gemini 4 Argon", { "7d": 100 }))).toBe("Antigravity Gemini 4 Argon · 7d 0%");
  });

  it("separates providers with a bar", () => {
    expect(line([...windows("Antigravity", { "5h": 71, "7d": 44 }), ...windows("OpenCode Go", { "5h": 71 })]))
      .toBe("Antigravity · 5h 29% · 7d 56% | OpenCode Go · 5h 29%");
  });

  it("shows USD spend against the allowance, or alone without one", () => {
    const spend = (allowanceUsd?: number): QuotaEntry => ({ kind: "spend", name: "Zed", group: "Zed", usedUsd: 2.45, allowanceUsd });
    expect(line([spend(10)])).toBe("Zed · $2.45 / $10.00");
    expect(line([spend()])).toBe("Zed · $2.45");
  });

  it("never shows a negative amount and keeps two decimals", () => {
    expect(line([{ kind: "spend", name: "Zed", group: "Zed", usedUsd: -1, allowanceUsd: 10 }])).toBe("Zed · $0.00 / $10.00");
  });

  it("truncates a line wider than 96 columns with an ellipsis", () => {
    const text = line(["A", "B", "C", "D", "E", "F"].flatMap((name) => windows(`Provider ${name}`, { "5h": 50, "7d": 50 })));
    expect(text.length).toBe(96);
    expect(text.endsWith("…")).toBe(true);
  });

  it("formats the prompt-cache part from the last step's tokens", () => {
    expect(formatSessionCachePart(3_480, 40_000)?.text).toBe("⚡92% (40K)");
    expect(formatSessionCachePart(100, 1_500_000)?.text).toBe("⚡100% (1.5M)");
    expect(formatSessionCachePart(500, 1_200)?.text).toBe("⚡71% (1.2K)");
    expect(formatSessionCachePart(500, 0)).toBeNull();
  });
});
