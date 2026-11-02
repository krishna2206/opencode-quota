/** Command Code: GET <url>/api/quota on commandcode-proxy (USD credits, 5h and 7d caps). */

import { describeFetchError, httpError, MESSAGES } from "../errors.js";
import type { Fetched } from "../provider.js";

export interface CommandCodeCap {
  window: string;
  displayName: string;
  cap: number;
  used: number;
  usedPercent: number;
  remainingPercent: number;
  status: string;
  resetsAtIso?: string | null;
  resetsInSeconds?: number | null;
}

export interface CommandCodeQuota {
  status: "ok" | "error";
  provider?: string;
  account?: {
    id: string;
    userName: string;
    plan: string;
    planDisplayName: string;
  } | null;
  credits?: {
    currency: string;
    monthlyAllowance: number;
    remaining: number;
    used: number;
    usedPercent: number;
    remainingPercent: number;
  } | null;
  fiveHour?: CommandCodeCap | null;
  sevenDay?: CommandCodeCap | null;
  timestamp?: string;
}

export async function fetchCommandCodeQuota(url: string, timeoutMs: number): Promise<Fetched<CommandCodeQuota>> {
  let response: Response;
  try {
    response = await fetch(`${url}/api/quota`, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    return { ok: false, error: describeFetchError(error) };
  }
  if (!response.ok) return { ok: false, error: httpError(response.status) };

  try {
    return { ok: true, data: (await response.json()) as CommandCodeQuota };
  } catch {
    return { ok: false, error: MESSAGES.invalidResponse };
  }
}
