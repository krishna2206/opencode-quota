/**
 * Antigravity provider.
 *
 * Reads the quota of the pool behind the session's model from the local proxy
 * (GET /api/quota?model=<id>): Gemini, Claude and Gemini 4 Argon each have
 * their own quota, and the proxy averages it over the accounts able to serve
 * the model. A proxy without that endpoint falls back to GET /api/status,
 * aggregated here into a health-weighted Gemini average.
 */

import {
  ANTIGRAVITY_STATUS_TIMEOUT_MS,
  fetchPoolQuota,
  resolveProxyPort,
  type ProxyFetchFailureReason,
} from "./fetch.js";
import { ANTIGRAVITY_LABEL, buildAntigravityEntries, buildPoolEntries } from "./parse.js";
import { fetchProxyStatusWithRetry } from "./retry.js";
import type { Provider, ProviderContext, ProviderResult } from "../types.js";

function antigravityError(reason: ProxyFetchFailureReason | null): { label: string; message: string } {
  switch (reason) {
    case "refused":
      return { label: ANTIGRAVITY_LABEL, message: "Proxy not installed or not running" };
    case "timeout":
      return { label: ANTIGRAVITY_LABEL, message: "Proxy timed out" };
    case "http":
      return { label: ANTIGRAVITY_LABEL, message: "Proxy returned an HTTP error" };
    case "parse":
      return { label: ANTIGRAVITY_LABEL, message: "Proxy returned an invalid status" };
    default:
      return { label: ANTIGRAVITY_LABEL, message: "Unavailable" };
  }
}

export const antigravityProvider: Provider = {
  id: "antigravity-proxy",

  matchesModel(model): boolean {
    return (model.providerID ?? "").trim().toLowerCase() === "antigravity-proxy";
  },

  async load(ctx: ProviderContext): Promise<ProviderResult> {
    const timeoutMs = Math.max(1_000, Math.min(ctx.requestTimeoutMs, ANTIGRAVITY_STATUS_TIMEOUT_MS));

    const modelID = ctx.model?.modelID?.trim();
    if (modelID) {
      const result = await fetchPoolQuota(await resolveProxyPort(), modelID, timeoutMs);
      if (result.pool) {
        if (result.pool.accounts === 0) {
          return {
            attempted: true,
            entries: [],
            errors: [{ label: ANTIGRAVITY_LABEL, message: "No account can serve this model" }],
          };
        }
        return { attempted: true, entries: buildPoolEntries(result.pool), errors: [] };
      }
      if (!result.unsupported) {
        return { attempted: true, entries: [], errors: [antigravityError(result.reason)] };
      }
    }
    const result = await fetchProxyStatusWithRetry(timeoutMs);

    if (!result.status) {
      return {
        attempted: true,
        entries: [],
        errors: [antigravityError(result.reason)],
      };
    }

    if ((result.status.accounts ?? []).length === 0) {
      return {
        attempted: true,
        entries: [],
        errors: [{ label: ANTIGRAVITY_LABEL, message: "No Antigravity accounts connected" }],
      };
    }

    return { attempted: true, entries: buildAntigravityEntries(result.status), errors: [] };
  },
};