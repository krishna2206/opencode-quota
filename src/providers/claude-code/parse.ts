/** Claude Code: the subscription's 5h and 7d windows. */

import type { ProviderResult, QuotaWindow } from "../../quota/types.js";
import { failure, MESSAGES } from "../errors.js";
import type { ClaudeCodeQuota, ClaudeCodeWindow } from "./fetch.js";

export const CLAUDE_CODE_LABEL = "Claude";

function toWindow(span: QuotaWindow["span"], window: ClaudeCodeWindow | null | undefined): QuotaWindow[] {
  if (!window || !Number.isFinite(window.remainingPercent)) return [];
  return [{ span, remainingPercent: window.remainingPercent, ...(window.resetsAtIso ? { resetAt: window.resetsAtIso } : {}) }];
}

export function parseClaudeCodeQuota(data: ClaudeCodeQuota): ProviderResult {
  if (data.status !== "ok") return failure(MESSAGES.unavailable);
  const windows = [...toWindow("5h", data.fiveHour), ...toWindow("7d", data.sevenDay)];
  return { ok: true, quotas: windows.length > 0 ? [{ kind: "window", windows }] : [] };
}
