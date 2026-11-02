/** Puter: credits used over the monthly allowance, as puter-proxy sums them. */

import type { ProviderResult } from "../../quota/types.js";
import { failure, MESSAGES } from "../errors.js";
import type { PuterQuota } from "./fetch.js";

export const PUTER_LABEL = "Puter";

export function parsePuterQuota(data: PuterQuota): ProviderResult {
  if (data.status !== "ok") return failure(data.message?.trim() || MESSAGES.unavailable);

  const credits = data.credits;
  if (!credits || !Number.isFinite(credits.used) || !Number.isFinite(credits.monthlyAllowance)) {
    return failure("credit allowance missing");
  }

  return {
    ok: true,
    quotas: [{
      kind: "credits",
      used: credits.used,
      allowance: credits.monthlyAllowance,
      ...(credits.resetsAt ? { resetAt: credits.resetsAt } : {}),
    }],
  };
}
