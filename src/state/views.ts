/** How a provider's latest result updates what the line shows for it. */

import type { ProviderResult } from "../quota/types.js";
import type { ProviderView } from "../render/line.js";

/**
 * - a quota replaces whatever was shown;
 * - a transient failure (proxy down, timeout) keeps the last known quota, so
 *   the line does not flicker between a value and an error;
 * - any other failure is shown: it says something about the quota
 *   ("not configured", "login required").
 */
export function nextView(previous: ProviderView | undefined, label: string, result: ProviderResult): ProviderView {
  if (result.ok) return { label: result.label ?? label, status: "ready", quotas: result.quotas };
  if (result.transient && previous?.status === "ready") return previous;
  return { label: previous?.label ?? label, status: "error", error: result.error };
}
