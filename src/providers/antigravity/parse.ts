/** Antigravity: the proxy's pool onto a window quota, labelled by its family. */

import type { ProviderResult, QuotaWindow } from "../../quota/types.js";
import type { AntigravityPool } from "./fetch.js";

export const ANTIGRAVITY_LABEL = "Antigravity";

const SPANS: Record<string, QuotaWindow["span"]> = { "5h": "5h", weekly: "7d", "7d": "7d" };

export function parsePool(pool: AntigravityPool): ProviderResult {
  if (pool.accounts === 0) return { ok: false, error: "no account can serve this model" };

  const windows = pool.windows.flatMap((window): QuotaWindow[] => {
    const span = SPANS[window.window];
    if (!span || !Number.isFinite(window.remainingPercent)) return [];
    return [{
      span,
      remainingPercent: Math.max(0, Math.min(100, window.remainingPercent)),
      ...(window.resetTime ? { resetAt: window.resetTime } : {}),
    }];
  });

  return {
    ok: true,
    // Gemini Flash is "Antigravity" alone; the gated pools name their family.
    label: pool.family === "gemini" ? ANTIGRAVITY_LABEL : `${ANTIGRAVITY_LABEL} ${pool.label}`,
    quotas: windows.length > 0 ? [{ kind: "window", windows }] : [],
  };
}
