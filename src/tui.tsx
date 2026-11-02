/** @jsxImportSource @opentui/solid */

/**
 * opencode-quota TUI plugin: one line under the prompt with the quota behind
 * the session's model and the prompt-cache stats of its last step.
 *
 *   src/providers/  one folder per provider: fetch, parse onto quota types
 *   src/quota/      the quota types and how a provider is run
 *   src/state/      what the line shows for the session in view
 *   src/render/     the line as data, its colours, its components
 *   src/session/    the session's model and cache stats
 */

import { Plugin } from "@opencode/plugin/tui";
import { StatusLine } from "./render/StatusLine.js";
import { createQuotaState } from "./state/quota-state.js";

export default Plugin.define({
  id: "opencode-quota",
  setup: (ctx) => {
    const quota = createQuotaState(ctx);

    // A line of its own at the very bottom, under opencode's prompt footer.
    // The prompt.footer slots all sit inside the footer's single row: anything
    // placed there shares it and squeezes the host's status ("esc interrupt").
    // The `app` slot comes after the whole route area in the app's column, so
    // a line there lands below everything, and the space above the prompt is
    // left to other plugins (opencode-todos).
    const unclaim = ctx.ui.slot({
      append: "app",
      render: () => <StatusLine ctx={ctx} quota={quota} />,
    });

    return () => {
      unclaim();
      quota.dispose();
    };
  },
});
