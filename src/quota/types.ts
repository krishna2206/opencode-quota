/**
 * The quota types every provider must return. Closed on purpose: the renderer
 * knows exactly these three shapes, and a provider maps whatever its proxy
 * sends onto one of them.
 *
 * Aggregation (several accounts behind one model) is never done here: each
 * proxy computes its pool and the provider passes the numbers through.
 */

/** Rolling windows a subscription quota is measured over. */
export type WindowSpan = "5h" | "7d";

export interface QuotaWindow {
  span: WindowSpan;
  /** 0-100. Rendered as the used share (100 - remaining). */
  remainingPercent: number;
  /** ISO timestamp of the next reset, when the proxy knows it. */
  resetAt?: string;
}

export type Quota =
  /** Subscription windows: "5h 29% · 7d 56%". */
  | { kind: "window"; windows: QuotaWindow[] }
  /** Pay-per-token spend in USD: "$2.45 / $10.00", or "$2.45" without an allowance. */
  | { kind: "tokens"; usedUsd: number; allowanceUsd?: number; resetAt?: string }
  /** Provider credits (not USD): "120 / 3000 cr", used over the allowance. */
  | { kind: "credits"; used: number; allowance: number; resetAt?: string };

export type ProviderResult =
  | {
      ok: true;
      quotas: Quota[];
      /** Replaces the provider label for this result, e.g. "Antigravity Claude" for a pool. */
      label?: string;
    }
  | {
      ok: false;
      /** Short, lower-case message shown after the label: "Zed · not configured". */
      error: string;
      /**
       * A failure that says nothing about the quota (proxy down, timeout,
       * garbled response): the last known quota stays on screen instead.
       */
      transient?: boolean;
    };
