/** Codex: GET <url>/api/quota on codex-proxy (the pool of its accounts, 5h and 7d). */

import { describeFetchError, httpError, MESSAGES } from "../errors.js";
import type { Fetched } from "../provider.js";

export interface CodexWindow {
  window: string;
  displayName: string;
  status: string;
  utilization: number;
  utilizationPercent: number;
  remainingPercent: number;
  remainingFraction: number;
  resetsAtIso?: string | null;
  resetsInSeconds?: number | null;
  contributingAccounts?: number;
}

export interface CodexQuota {
  status: "ok" | "unavailable";
  provider?: string;
  accountsCount?: number;
  activeAccountsCount?: number;
  fiveHour?: CodexWindow | null;
  sevenDay?: CodexWindow | null;
  timestamp?: string;
}

export async function fetchCodexQuota(url: string, timeoutMs: number): Promise<Fetched<CodexQuota>> {
  let response: Response;
  try {
    response = await fetch(`${url}/api/quota`, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    return { ok: false, error: describeFetchError(error) };
  }
  if (!response.ok) return { ok: false, error: httpError(response.status) };

  try {
    return { ok: true, data: (await response.json()) as CodexQuota };
  } catch {
    return { ok: false, error: MESSAGES.invalidResponse };
  }
}
