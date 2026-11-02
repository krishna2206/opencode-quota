/**
 * OpenCode Go: the dashboard's rolling (~5h) and weekly windows. The monthly
 * window the dashboard also shows is left out for now.
 */

import type { ProviderResult, QuotaWindow } from "../../quota/types.js";
import { failure } from "../errors.js";
import type { ScrapedUsage } from "./fetch.js";

export const OPENCODE_GO_LABEL = "OpenCode Go";

const WINDOWS = [
  { source: "rolling", span: "5h" },
  { source: "weekly", span: "7d" },
] as const;

export function parseOpenCodeGoUsage(usage: ScrapedUsage, now: number): ProviderResult {
  const windows = WINDOWS.flatMap(({ source, span }): QuotaWindow[] => {
    const value = usage[source];
    if (!value) return [];
    return [{
      span,
      remainingPercent: Math.max(0, 100 - Math.max(0, value.usagePercent)),
      resetAt: new Date(now + Math.max(0, value.resetInSec) * 1_000).toISOString(),
    }];
  });

  if (windows.length === 0) return failure("no usage windows on the dashboard");
  return { ok: true, quotas: [{ kind: "window", windows }] };
}
