/** Codex: the pool's 5h and 7d windows, as codex-proxy computes them. */

import type { ProviderResult, QuotaWindow } from "../../quota/types.js";
import { failure, MESSAGES } from "../errors.js";
import type { CodexQuota, CodexWindow } from "./fetch.js";

export const CODEX_LABEL = "Codex";

function toWindow(span: QuotaWindow["span"], window: CodexWindow | null | undefined): QuotaWindow[] {
  if (!window || !Number.isFinite(window.remainingPercent)) return [];
  return [{ span, remainingPercent: window.remainingPercent, ...(window.resetsAtIso ? { resetAt: window.resetsAtIso } : {}) }];
}

export function parseCodexQuota(data: CodexQuota): ProviderResult {
  if (data.status !== "ok") return failure(MESSAGES.unavailable);
  if (data.accountsCount === 0) return failure(MESSAGES.noAccount);
  const windows = [...toWindow("5h", data.fiveHour), ...toWindow("7d", data.sevenDay)];
  return { ok: true, quotas: windows.length > 0 ? [{ kind: "window", windows }] : [] };
}
