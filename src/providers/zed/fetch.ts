/** Zed: GET <url>/api/quota on zed-proxy (pay-per-token spend in USD). */

import { describeFetchError, httpError, MESSAGES } from "../errors.js";
import type { Fetched } from "../provider.js";

export interface ZedQuota {
  status: "ok" | "error";
  provider?: string;
  /** "pay-per-token": no 5h/7d windows, only spend in USD. */
  type?: string;
  message?: string;
  /** `login_required` -> reconnect; `exhausted` -> connect another account. */
  state?: { status: "ok" | "login_required" | "exhausted"; message?: string | null } | null;
  credits?: {
    currency: string;
    monthlyAllowance: number;
    usedUsd: number;
    remainingUsd: number;
    usedPercent: number;
    remainingPercent: number;
    renewsAt?: string | null;
    daysRemaining?: number | null;
  } | null;
  timestamp?: string;
}

export async function fetchZedQuota(url: string, timeoutMs: number): Promise<Fetched<ZedQuota>> {
  let response: Response;
  try {
    response = await fetch(`${url}/api/quota`, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    return { ok: false, error: describeFetchError(error) };
  }
  if (!response.ok) return { ok: false, error: httpError(response.status) };

  try {
    return { ok: true, data: (await response.json()) as ZedQuota };
  } catch {
    return { ok: false, error: MESSAGES.invalidResponse };
  }
}
