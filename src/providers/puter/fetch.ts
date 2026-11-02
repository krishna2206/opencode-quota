/** Puter: GET <url>/api/quota on puter-proxy (monthly credits, summed over its accounts). */

import { describeFetchError, httpError, MESSAGES } from "../errors.js";
import type { Fetched } from "../provider.js";

export interface PuterQuota {
  status: "ok" | "error";
  provider?: string;
  message?: string;
  credits?: {
    unit: string;
    monthlyAllowance: number;
    remaining: number;
    used: number;
    usedPercent: number;
    resetsAt?: string;
  };
}

export async function fetchPuterQuota(url: string, timeoutMs: number): Promise<Fetched<PuterQuota>> {
  let response: Response;
  try {
    response = await fetch(`${url}/api/quota`, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    return { ok: false, error: describeFetchError(error) };
  }
  if (!response.ok) return { ok: false, error: httpError(response.status) };

  try {
    return { ok: true, data: (await response.json()) as PuterQuota };
  } catch {
    return { ok: false, error: MESSAGES.invalidResponse };
  }
}
