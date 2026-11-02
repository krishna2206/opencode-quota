/** @jsxImportSource @opentui/solid */

/**
 * The status line under the prompt. Only drawn inside a session: the quota
 * line has nothing to say elsewhere.
 */

import type { Plugin } from "@opencode/plugin/tui";
import { useTerminalDimensions } from "@opentui/solid";
import { createEffect, createMemo, For, Show } from "solid-js";
import { lastStepCache } from "../session/cache.js";
import { promptModel } from "../session/model.js";
import type { QuotaState } from "../state/quota-state.js";
import { tone, toneColor } from "./colors.js";
import { buildLine } from "./line.js";

type Ctx = Plugin.Context;

function SessionLine(props: { ctx: Ctx; quota: QuotaState; sessionID: string }) {
  // The prompt's model, when set, is the freshest answer to "which quota":
  // it follows a model switch before the session record does.
  createEffect(() => {
    void props.quota.follow(props.sessionID, promptModel(props.ctx));
  });

  const parts = createMemo(() => buildLine(props.quota.views(), lastStepCache(props.ctx, props.sessionID)));

  // The session view pads its content by 1 or 2 columns, by terminal width;
  // the same padding lines the quota up under the footer's path.
  const dimensions = useTerminalDimensions();
  const gutter = () => (dimensions().width < 44 ? 1 : 2);

  return (
    <Show when={parts().length > 0}>
      <box
        flexDirection="row"
        justifyContent="flex-start"
        width="100%"
        flexShrink={0}
        // The session view ends with an empty padding row (paddingBottom 1):
        // move up onto it, so the line sits right under the prompt footer.
        marginTop={-1}
        paddingLeft={gutter()}
        paddingRight={gutter()}
      >
        <For each={parts()}>
          {(part) => (
            <text fg={toneColor(props.ctx.theme, tone(part))} wrapMode="none">
              {part.text}
            </text>
          )}
        </For>
      </box>
    </Show>
  );
}

/** The `app` slot renders under every route: follow the router to find the session. */
export function StatusLine(props: { ctx: Ctx; quota: QuotaState }) {
  const sessionID = () => {
    const route = props.ctx.ui.router.current();
    return route.type === "session" ? route.sessionID : undefined;
  };

  createEffect(() => {
    if (!sessionID()) void props.quota.follow(undefined);
  });

  return (
    <Show when={sessionID()}>
      {(id: () => string) => <SessionLine ctx={props.ctx} quota={props.quota} sessionID={id()} />}
    </Show>
  );
}
