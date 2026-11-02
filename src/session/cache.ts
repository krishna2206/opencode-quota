/**
 * Prompt-cache stats of the session's most recent assistant step: per step
 * rather than cumulative, so a cache regression shows at once. Read from
 * opencode's messages, so it is shown whatever the quota provider knows.
 */

import type { Plugin } from "@opencode/plugin/tui";
import type { CacheStat } from "../render/line.js";

export function lastStepCache(ctx: Plugin.Context, sessionID: string): CacheStat | null {
  try {
    const messages = ctx.data.session.message.list(sessionID);
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.type !== "assistant") continue;
      const inputTokens = message.tokens?.input ?? 0;
      const cacheReadTokens = message.tokens?.cache?.read ?? 0;
      if (inputTokens <= 0 && cacheReadTokens <= 0) continue;
      return { inputTokens, cacheReadTokens };
    }
  } catch {
    // The data layer is not ready for this session yet.
  }
  return null;
}
