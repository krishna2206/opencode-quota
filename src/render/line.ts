/**
 * The status line, as data: what each provider shows, then the prompt cache.
 *
 *   Antigravity Claude · 5h 29% · 7d 56% · ⚡92% (40K)
 *   CommandCode · $10.00 / $10.00 · 5h 0% · 7d 0%
 *   Zed · not configured · ⚡92% (40K)
 *
 * Pure: no TUI, no theme. Each part carries what decides its colour (see
 * colors.ts). Percentages are the used share of a window.
 */

import type { Quota, QuotaWindow } from "../quota/types.js";

export const MAX_WIDTH = 96;

const WITHIN = " · ";
const BETWEEN = " | ";

export type Part =
  | { kind: "label"; text: string }
  | { kind: "separator"; text: string }
  | { kind: "window"; text: string; remainingPercent: number }
  | { kind: "tokens"; text: string; usedRatio: number }
  | { kind: "credits"; text: string; usedRatio: number }
  | { kind: "cache"; text: string; hitRatio: number }
  | { kind: "error"; text: string }
  | { kind: "pending"; text: string };

/** What one provider has to show for the session's model. */
export type ProviderView = { label: string } & (
  | { status: "loading" }
  | { status: "ready"; quotas: readonly Quota[] }
  | { status: "error"; error: string }
);

/** Token counts of the session's last assistant step. */
export interface CacheStat {
  inputTokens: number;
  cacheReadTokens: number;
}

export function sanitize(text: string): string {
  return text.replaceAll(/\p{C}/gu, " ").replace(/\s+/g, " ").trim();
}

export function formatUsd(amount: number): string {
  return `$${Math.max(0, amount).toFixed(2)}`;
}

export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 10_000) return `${Math.round(count / 1_000)}K`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function usedPercent(window: QuotaWindow): string {
  return `${Math.round(Math.max(0, Math.min(100, 100 - window.remainingPercent)))}%`;
}

function ratio(used: number, allowance: number | undefined): number {
  return allowance && allowance > 0 ? Math.max(0, used) / allowance : 0;
}

function quotaParts(quota: Quota): Part[][] {
  switch (quota.kind) {
    case "window":
      return quota.windows.map((window) => [
        { kind: "label", text: `${window.span} ` },
        { kind: "window", text: usedPercent(window), remainingPercent: window.remainingPercent },
      ]);
    case "tokens": {
      const text = quota.allowanceUsd && quota.allowanceUsd > 0
        ? `${formatUsd(quota.usedUsd)} / ${formatUsd(quota.allowanceUsd)}`
        : formatUsd(quota.usedUsd);
      return [[{ kind: "tokens", text, usedRatio: ratio(quota.usedUsd, quota.allowanceUsd) }]];
    }
    case "credits": {
      const text = `${Math.max(0, quota.used).toFixed(0)} / ${Math.max(0, quota.allowance).toFixed(0)} cr`;
      return [[{ kind: "credits", text, usedRatio: ratio(quota.used, quota.allowance) }]];
    }
  }
}

function joinGroups(groups: Part[][], separator: string): Part[] {
  return groups.flatMap((group, index) => (index === 0 ? group : [{ kind: "separator" as const, text: separator }, ...group]));
}

function providerParts(view: ProviderView): Part[] {
  const label: Part = { kind: "label", text: `${sanitize(view.label)}${WITHIN}` };
  switch (view.status) {
    case "loading":
      return [label, { kind: "pending", text: "loading…" }];
    case "error":
      return [label, { kind: "error", text: sanitize(view.error) }];
    case "ready": {
      const groups = view.quotas.flatMap(quotaParts);
      if (groups.length === 0) return [label, { kind: "pending", text: "no quota reported" }];
      return [label, ...joinGroups(groups, WITHIN)];
    }
  }
}

/** "⚡92% (40K)": share of the last step's input read from the prompt cache. */
export function cachePart(stat: CacheStat): Part | null {
  if (stat.cacheReadTokens <= 0) return null;
  const total = stat.inputTokens + stat.cacheReadTokens;
  const hitRatio = total > 0 ? Math.round((stat.cacheReadTokens / total) * 100) : 0;
  return { kind: "cache", text: `⚡${hitRatio}% (${formatTokenCount(stat.cacheReadTokens)})`, hitRatio };
}

function truncate(parts: Part[], maxWidth: number): Part[] {
  const out: Part[] = [];
  let remaining = maxWidth;
  for (const part of parts) {
    if (part.text.length <= remaining) {
      out.push(part);
      remaining -= part.text.length;
      continue;
    }
    out.push(remaining <= 1 ? { kind: "label", text: "…" } : { ...part, text: `${part.text.slice(0, remaining - 1).trimEnd()}…` });
    break;
  }
  return out;
}

/** Providers joined by " | ", then the cache part, cut at `maxWidth` columns. */
export function buildLine(providers: readonly ProviderView[], cache: CacheStat | null, maxWidth = MAX_WIDTH): Part[] {
  const quota = joinGroups(providers.map(providerParts), BETWEEN);
  const cached = cache ? cachePart(cache) : null;
  const parts = cached ? (quota.length > 0 ? [...quota, { kind: "separator" as const, text: WITHIN }, cached] : [cached]) : quota;
  return truncate(parts, maxWidth);
}

export function lineText(parts: readonly Part[]): string {
  return parts.map((part) => part.text).join("");
}
