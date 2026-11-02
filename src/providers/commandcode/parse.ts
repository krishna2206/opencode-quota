/**
 * Command Code: the monthly USD credit (what actually runs out) and the 5h and
 * 7d caps, shown as the proxy reports them.
 */

import type { ProviderResult, Quota, QuotaWindow } from "../../quota/types.js";
import { failure, MESSAGES } from "../errors.js";
import type { CommandCodeCap, CommandCodeQuota } from "./fetch.js";

export const COMMANDCODE_LABEL = "CommandCode";

function toWindow(span: QuotaWindow["span"], cap: CommandCodeCap | null | undefined): QuotaWindow[] {
  if (!cap || !Number.isFinite(cap.remainingPercent)) return [];
  return [{ span, remainingPercent: cap.remainingPercent, ...(cap.resetsAtIso ? { resetAt: cap.resetsAtIso } : {}) }];
}

export function parseCommandCodeQuota(data: CommandCodeQuota): ProviderResult {
  if (data.status !== "ok") return failure(MESSAGES.unavailable);
  if (!data.account) return failure(MESSAGES.noAccount);

  const quotas: Quota[] = [];
  const credits = data.credits;
  if (credits && Number.isFinite(credits.used)) {
    quotas.push({
      kind: "tokens",
      usedUsd: credits.used,
      ...(credits.monthlyAllowance > 0 ? { allowanceUsd: credits.monthlyAllowance } : {}),
    });
  }
  const windows = [...toWindow("5h", data.fiveHour), ...toWindow("7d", data.sevenDay)];
  if (windows.length > 0) quotas.push({ kind: "window", windows });

  return { ok: true, quotas };
}
