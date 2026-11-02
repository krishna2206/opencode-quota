/**
 * Where each proxy provider reads its quota.
 *
 * Resolution, first match wins:
 *   1. OPENCODE_QUOTA_<ID>_URL environment variable (a one-off override, e.g.
 *      a test instance), with the id upper-cased and non-alphanumerics as "_";
 *   2. `options.providers[<id>].url` in the plugin entry of opencode.jsonc.
 *
 * There is no default: an unconfigured provider says so on the line rather
 * than guessing a port.
 */

import { MESSAGES } from "./providers/errors.js";

export interface PluginOptions {
  providers?: Record<string, { url?: unknown } | undefined>;
}

export type URLResolution = { ok: true; url: string } | { ok: false; error: string };

export function envVarName(providerID: string): string {
  return `OPENCODE_QUOTA_${providerID.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_URL`;
}

export function resolveProviderURL(
  providerID: string,
  options: PluginOptions | undefined,
  env: Record<string, string | undefined> = process.env,
): URLResolution {
  const fromEnv = env[envVarName(providerID)]?.trim();
  const fromOptions = options?.providers?.[providerID]?.url;
  const raw = fromEnv || (typeof fromOptions === "string" ? fromOptions.trim() : "");
  if (!raw) return { ok: false, error: MESSAGES.notConfigured };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: MESSAGES.invalidURL };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, error: MESSAGES.invalidURL };

  // Providers append their own path ("/api/quota"): no trailing slash.
  return { ok: true, url: url.href.replace(/\/+$/, "") };
}
