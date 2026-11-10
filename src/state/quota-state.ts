/**
 * What the line shows for the session in view: the providers of its model,
 * each with its latest view, refreshed on a timer and after opencode events.
 */

import type { Plugin } from "@opencode/plugin/tui";
import { createSignal } from "solid-js";
import type { PluginOptions } from "../config.js";
import { providersFor } from "../providers/index.js";
import type { QuotaProvider, SessionModel } from "../providers/provider.js";
import { loadProvider } from "../quota/load.js";
import type { ProviderResult } from "../quota/types.js";
import { createRefreshLifecycle } from "../refresh/lifecycle.js";
import { throttleLeading } from "../refresh/throttle.js";
import type { ProviderView } from "../render/line.js";
import { extractModel, getSessionModel } from "../session/model.js";
import { nextFailedView, nextView } from "./views.js";

type Ctx = Plugin.Context;

const REFRESH_INTERVAL_MS = 60_000;
const EVENT_REFRESH_DELAYS_MS = [150, 600] as const;
const MOUNT_RECOVERY_DELAYS_MS = [500, 1_500, 4_000] as const;
const REQUEST_TIMEOUT_MS = 5_000;
/**
 * `session.usage.updated` fires after every step of a long agentic run. Quota
 * does not need that granularity: one refresh per window, and the exact value
 * after a turn comes from `session.idle`.
 */
const STREAMING_REFRESH_THROTTLE_MS = 30_000;

export interface QuotaState {
  /** One view per provider of the current model, in provider order. */
  views: () => readonly ProviderView[];
  /** Follow a session (undefined: none in view), with its model if already known. */
  follow: (sessionID: string | undefined, known?: SessionModel) => Promise<void>;
  dispose: () => void;
}

interface Target {
  key: string;
  model: SessionModel;
  providers: readonly QuotaProvider[];
}

const NO_TARGET: Target = { key: "", model: {}, providers: [] };

export function createQuotaState(ctx: Ctx): QuotaState {
  const options = ctx.options as PluginOptions | undefined;
  const [views, setViews] = createSignal<readonly ProviderView[]>([]);
  let target = NO_TARGET;
  let sessionID: string | undefined;
  let followVersion = 0;

  const lifecycle = createRefreshLifecycle<{ key: string; results: ProviderResult[] }>({
    load: async () => {
      const { key, model, providers } = target;
      const results = await Promise.all(
        providers.map((provider) => loadProvider(provider, { model, options, timeoutMs: REQUEST_TIMEOUT_MS })),
      );
      return { key, results };
    },
    apply: ({ key, results }) => {
      // A load started before a model switch must not overwrite the new target.
      if (key !== target.key) return;
      const previous = views();
      setViews(target.providers.map((provider, index) => nextView(previous[index], provider.label, results[index]!)));
    },
    onFailure: () => {
      const previous = views();
      setViews(target.providers.map((provider, index) => nextFailedView(previous[index], provider.label)));
    },
    intervalMs: REFRESH_INTERVAL_MS,
    eventRefreshDelaysMs: EVENT_REFRESH_DELAYS_MS,
    recoveryDelaysMs: MOUNT_RECOVERY_DELAYS_MS,
    subscribe: (scheduleRefresh) => [
      ctx.data.on("session.execution.succeeded", () => scheduleRefresh()),
      ctx.data.on("session.execution.failed", () => scheduleRefresh()),
      ctx.data.on("session.execution.interrupted", () => scheduleRefresh()),
      ctx.data.on("session.idle", () => scheduleRefresh()),
      ctx.data.on("session.revert.committed", () => scheduleRefresh()),
      ctx.data.on("session.usage.updated", throttleLeading(() => scheduleRefresh(), STREAMING_REFRESH_THROTTLE_MS)),
      // The event carries the new model, which the session record may not
      // reflect yet; other sessions' switches are ignored.
      ctx.data.on("session.model.selected", (event) => {
        if (event.data.sessionID !== sessionID) return;
        void follow(sessionID, extractModel(event.data));
      }),
    ],
  });

  const retarget = (next: Target) => {
    if (next.key === target.key) return;
    target = next;
    setViews(next.providers.map((provider) => ({ label: provider.label, status: "loading" as const })));
    if (next.providers.length > 0) lifecycle.reload();
  };

  const follow = async (nextSession: string | undefined, known?: SessionModel) => {
    sessionID = nextSession;
    const version = ++followVersion;
    if (!nextSession) return retarget(NO_TARGET);

    const model = known && (known.providerID || known.modelID) ? known : await getSessionModel(ctx, nextSession);
    if (version !== followVersion) return;
    retarget({
      key: `${nextSession}:${model.providerID ?? ""}/${model.modelID ?? ""}`,
      model,
      providers: providersFor(model),
    });
  };

  return { views, follow, dispose: lifecycle.dispose };
}
