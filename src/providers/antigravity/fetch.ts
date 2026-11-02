/**
 * Antigravity: GET <url>/api/quota?model=<id> on antigravity-proxy.
 *
 * The proxy returns the pool behind the model, already aggregated over the
 * accounts able to serve it (Gemini, Claude and Gemini 4 Argon each have
 * their own quota). Retried briefly: the proxy may still be starting.
 */

import { describeFetchError, httpError, MESSAGES } from "../errors.js";
import type { Fetched } from "../provider.js";

export interface AntigravityPool {
  model: string;
  /** "gemini" | "claude" | "argon" */
  family: string;
  /** "Gemini" | "Claude" | "Gemini 4 Argon" */
  label: string;
  /** Accounts able to serve the model; 0 means none can. */
  accounts: number;
  windows: Array<{ window: string; remainingPercent: number; resetTime?: string }>;
}

const BACKOFF_MS = [150, 400, 1_000] as const;

async function fetchOnce(url: string, modelID: string, timeoutMs: number): Promise<Fetched<AntigravityPool>> {
  let response: Response;
  try {
    response = await fetch(`${url}/api/quota?model=${encodeURIComponent(modelID)}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return { ok: false, error: describeFetchError(error) };
  }
  if (!response.ok) return { ok: false, error: httpError(response.status) };

  try {
    const data = (await response.json()) as AntigravityPool;
    if (!data || !Array.isArray(data.windows)) return { ok: false, error: MESSAGES.invalidResponse };
    return { ok: true, data };
  } catch {
    return { ok: false, error: MESSAGES.invalidResponse };
  }
}

export async function fetchPool(url: string, modelID: string, timeoutMs: number): Promise<Fetched<AntigravityPool>> {
  let result = await fetchOnce(url, modelID, timeoutMs);
  for (const delay of BACKOFF_MS) {
    if (result.ok) return result;
    await new Promise((resolve) => setTimeout(resolve, delay));
    result = await fetchOnce(url, modelID, timeoutMs);
  }
  return result;
}
