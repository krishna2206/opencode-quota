/**
 * The contract of a quota provider.
 *
 * A provider owns everything about its source: how it matches a model, how it
 * fetches (each proxy has its own endpoint and response), and how it maps the
 * response onto the plugin's quota types. It never reads the environment or the
 * plugin options: the URL it needs arrives resolved (see config.ts).
 */

import type { ProviderResult } from "../quota/types.js";

/** The model in use in the session, as opencode identifies it. */
export interface SessionModel {
  providerID?: string;
  modelID?: string;
}

interface ProviderBase {
  /** Stable id, also the key of the provider in the plugin options. */
  readonly id: string;
  /** Shown before the quota: "Antigravity · 5h 29%". */
  readonly label: string;
  /** Whether this provider holds the quota of the session's model. */
  matches(model: SessionModel): boolean;
}

/** Reads a local proxy, whose URL must be configured. */
export interface ProxyProvider extends ProviderBase {
  readonly kind: "proxy";
  load(ctx: { url: string; model: SessionModel; timeoutMs: number }): Promise<ProviderResult>;
}

/** Reaches a fixed endpoint of its own (no URL to configure). */
export interface DirectProvider extends ProviderBase {
  readonly kind: "direct";
  load(ctx: { model: SessionModel; timeoutMs: number }): Promise<ProviderResult>;
}

export type QuotaProvider = ProxyProvider | DirectProvider;

/** Outcome of a provider's own fetch, before mapping onto quota types. */
export type Fetched<T> = { ok: true; data: T } | { ok: false; error: string };

/** Lower-cased, trimmed ids: what every `matches` compares. */
export function normalizeModel(model: SessionModel): { providerID: string; modelID: string } {
  return {
    providerID: (model.providerID ?? "").trim().toLowerCase(),
    modelID: (model.modelID ?? "").trim().toLowerCase(),
  };
}
