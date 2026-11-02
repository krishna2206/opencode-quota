/** Zed: the connected account's USD spend against its monthly allowance. */

import type { ProviderResult } from "../../quota/types.js";
import { failure, MESSAGES } from "../errors.js";
import type { ZedQuota } from "./fetch.js";

export const ZED_LABEL = "Zed";

export function parseZedQuota(data: ZedQuota): ProviderResult {
  if (data.status !== "ok" || !data.credits) return failure(data.message?.trim() || MESSAGES.noAccount);

  // Actionable states win over the spend: the account cannot serve requests until reconnected.
  const state = data.state?.status;
  if (state === "login_required") return failure("login required (/zed-login)");
  if (state === "exhausted") return failure("credits exhausted (/zed-login)");

  const { usedUsd, monthlyAllowance, renewsAt } = data.credits;
  if (!Number.isFinite(usedUsd)) return failure(MESSAGES.invalidResponse);

  return {
    ok: true,
    quotas: [{
      kind: "tokens",
      usedUsd,
      ...(monthlyAllowance > 0 ? { allowanceUsd: monthlyAllowance } : {}),
      ...(renewsAt ? { resetAt: renewsAt } : {}),
    }],
  };
}
