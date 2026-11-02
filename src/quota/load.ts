/**
 * Runs one provider for the session's model: resolves its URL when it needs
 * one, then loads. Never throws: a bug in a provider shows as an error on the
 * line instead of breaking the refresh.
 */

import { resolveProviderURL, type PluginOptions } from "../config.js";
import type { QuotaProvider, SessionModel } from "../providers/provider.js";
import type { ProviderResult } from "./types.js";

export interface LoadContext {
  model: SessionModel;
  options: PluginOptions | undefined;
  timeoutMs: number;
}

export async function loadProvider(provider: QuotaProvider, ctx: LoadContext): Promise<ProviderResult> {
  try {
    if (provider.kind === "direct") {
      return await provider.load({ model: ctx.model, timeoutMs: ctx.timeoutMs });
    }
    const url = resolveProviderURL(provider.id, ctx.options);
    if (!url.ok) return { ok: false, error: url.error };
    return await provider.load({ url: url.url, model: ctx.model, timeoutMs: ctx.timeoutMs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `unexpected error: ${message}`, transient: true };
  }
}
