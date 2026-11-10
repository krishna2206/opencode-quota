/** How a provider's latest result updates what the line shows for it. */

import type { ProviderResult } from "../quota/types.js";
import type { ProviderView } from "../render/line.js";

/** Without a successful refresh for this long, the shown quota is flagged stale. */
export const STALE_AFTER_MS = 5 * 60_000;

/**
 * - a quota replaces whatever was shown;
 * - a transient failure (proxy down, timeout) keeps the last known quota, so
 *   the line does not flicker between a value and an error; once failures have
 *   lasted STALE_AFTER_MS the kept quota is flagged stale, so a frozen value
 *   never looks current;
 * - any other failure is shown: it says something about the quota
 *   ("not configured", "login required").
 */
export function nextView(
  previous: ProviderView | undefined,
  label: string,
  result: ProviderResult,
  now: number = Date.now(),
): ProviderView {
  if (result.ok) return { label: result.label ?? label, status: "ready", quotas: result.quotas };
  if (result.transient && previous?.status === "ready") {
    const failingSince = previous.failingSince ?? now;
    return { ...previous, failingSince, stale: now - failingSince >= STALE_AFTER_MS };
  }
  return { label: previous?.label ?? label, status: "error", error: result.error };
}

/** A refresh that produced no result at all (abandoned or crashed): a transient failure. */
export function nextFailedView(previous: ProviderView | undefined, label: string, now: number = Date.now()): ProviderView {
  return nextView(previous, label, { ok: false, error: "refresh failed", transient: true }, now);
}
