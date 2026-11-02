/** Which model a session uses: what decides the quota to show. */

import type { Plugin } from "@opencode/plugin/tui";
import type { SessionModel } from "../providers/provider.js";

type Ctx = Plugin.Context;

/** Reads `{ providerID, id | modelID }`, directly or under `.model`. */
export function extractModel(input: unknown): SessionModel {
  if (!input || typeof input !== "object") return {};
  const direct = input as { providerID?: string; id?: string; modelID?: string };
  if (direct.providerID && (direct.id || direct.modelID)) {
    return { providerID: direct.providerID, modelID: direct.id ?? direct.modelID };
  }
  const nested = (input as { model?: { providerID?: string; id?: string; modelID?: string } }).model;
  const providerID = nested?.providerID;
  const modelID = nested?.id ?? nested?.modelID;
  return providerID || modelID ? { providerID, modelID } : {};
}

function isKnown(model: SessionModel): boolean {
  return Boolean(model.providerID || model.modelID);
}

/**
 * The session record first, then its last assistant message. The data layer
 * may not have synced a session the host has not rendered yet, so a miss
 * triggers one sync before giving up.
 */
export async function getSessionModel(ctx: Ctx, sessionID: string): Promise<SessionModel> {
  const fromData = (): SessionModel => {
    const fromSession = extractModel(ctx.data.session.get(sessionID));
    if (isKnown(fromSession)) return fromSession;
    const messages = ctx.data.session.message.list(sessionID);
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.type !== "assistant") continue;
      const fromMessage = extractModel(message);
      if (isKnown(fromMessage)) return fromMessage;
    }
    return {};
  };

  const first = fromData();
  if (isKnown(first)) return first;
  await ctx.data.session.sync(sessionID).catch(() => {});
  return fromData();
}

/** The model selected in the prompt, when there is one. Reactive in a Solid computation. */
export function promptModel(ctx: Ctx): SessionModel | undefined {
  const current = ctx.ui.model.current();
  return current ? { providerID: current.providerID, modelID: current.modelID } : undefined;
}
