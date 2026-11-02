/**
 * The messages shown after a provider's label when its quota is unavailable,
 * so every provider words the same failure the same way.
 */

import type { ProviderResult } from "../quota/types.js";

export const MESSAGES = {
  notConfigured: "not configured",
  invalidURL: "invalid URL",
  unreachable: "proxy unreachable",
  timeout: "proxy timed out",
  invalidResponse: "invalid response",
  noAccount: "no account connected",
  unavailable: "quota unavailable",
} as const;

export function httpError(status: number): string {
  return `proxy error ${status}`;
}

/** What a thrown `fetch` means: a timeout, nothing listening, or anything else. */
export function describeFetchError(error: unknown): string {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return MESSAGES.timeout;
  }
  return MESSAGES.unreachable;
}

/** A failure that says nothing about the quota: the last known value stays shown. */
export function transientFailure(error: string): ProviderResult {
  return { ok: false, error, transient: true };
}

export function failure(error: string): ProviderResult {
  return { ok: false, error };
}
