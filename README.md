# opencode-quota

One line under the opencode prompt: the quota behind the session's model, and
the prompt-cache stats of its last step.

```
Antigravity Claude · 5h 29% · 7d 56% · ⚡92% (40K)
CommandCode · $10.00 / $10.00 · 5h 0% · 7d 0%
Puter · 0 / 3000 cr · ⚡100% (89K)
Zed · not configured · ⚡92% (40K)
⚡92% (40K)                                  (a model without a quota provider)
```

Percentages are the **used** share of a window. The cache part is always shown:
it comes from opencode's messages, not from a provider.

## Configuration

The plugin is TUI-only, so it is declared in opencode's TUI config,
`~/.config/opencode/cli.json`. Options set on a plugin in `opencode.jsonc` do
not reach the TUI.

```json
{
  "plugins": [
    {
      "package": "file:///path/to/opencode-quota/dist",
      "options": {
        "providers": {
          "antigravity-proxy": { "url": "http://127.0.0.1:7438" },
          "claude-code-proxy": { "url": "http://127.0.0.1:7439" },
          "codex-proxy": { "url": "http://127.0.0.1:7440" },
          "commandcode-proxy": { "url": "http://127.0.0.1:7442" },
          "zed-proxy": { "url": "http://127.0.0.1:7443" },
          "puter": { "url": "http://127.0.0.1:7444" }
        }
      }
    }
  ]
}
```

- **No default URL.** A provider missing from `providers` shows
  `<Provider> · not configured` and is never called.
- **One-off override:** `OPENCODE_QUOTA_<ID>_URL`, the id upper-cased with
  non-alphanumerics as `_`, wins over the options. Example:
  `OPENCODE_QUOTA_ANTIGRAVITY_PROXY_URL=http://127.0.0.1:7450`.
- **OpenCode Go** scrapes opencode.ai and needs credentials instead of a URL:
  `OPENCODE_GO_WORKSPACE_ID` and `OPENCODE_GO_AUTH_COOKIE`, or
  `~/.config/opencode/opencode-quota/quota.json`:
  `{ "credentials": { "workspaceId": "...", "authCookie": "..." } }`.

## Providers

| Id | Source | Quota type |
|---|---|---|
| `antigravity-proxy` | `GET /api/quota?model=<id>`: the pool behind the model (Gemini, Claude, Gemini 4 Argon) | window |
| `claude-code-proxy` | `GET /api/quota` | window |
| `codex-proxy` | `GET /api/quota` | window |
| `commandcode-proxy` | `GET /api/quota` | tokens + window |
| `zed-proxy` | `GET /api/quota` | tokens |
| `puter` | `GET /api/quota` | credits |
| `opencode-go` | the workspace dashboard on opencode.ai | window |

**The proxy computes, the plugin displays.** When several accounts sit behind
one model, the proxy aggregates them (share of the pool's capacity left:
Σ remaining / Σ limit over the usable accounts, health left out). The plugin
never recomputes a quota.

## Quota types

Every provider maps its response onto one of three types
(`src/quota/types.ts`):

| Type | Shape | Rendered | Colour |
|---|---|---|---|
| `window` | 5h / 7d windows, remaining % | `5h 29% · 7d 56%` (used) | green ≥ 50% left, yellow ≥ 20%, red below |
| `tokens` | USD used, USD allowance | `$2.45 / $10.00`, or `$2.45` | yellow from 80% used, red from 95% |
| `credits` | credits used, allowance | `120 / 3000 cr` | yellow from 50% used, red from 80% |

Errors read `<Provider> · <message>`: `not configured`, `invalid URL`,
`proxy unreachable`, `proxy timed out`, `proxy error <status>`,
`invalid response`, `no account connected`, or the provider's own message.
A failure that says nothing about the quota (proxy down, timeout) keeps the
last known value on screen instead.

## Layout

```
src/
  index.ts              empty server entry (opencode requires one)
  tui.tsx               Plugin.define + the slot claim
  config.ts             provider URL: env > options, no default
  quota/
    types.ts            the quota types and ProviderResult
    load.ts             runs a provider (URL resolution, never throws)
  providers/
    provider.ts         the provider contract
    errors.ts           shared error wording
    index.ts            the provider list
    <provider>/
      fetch.ts          its own request and response type
      parse.ts          response -> quota types
      index.ts          id, label, model matching, load
  state/
    quota-state.ts      what the line shows for the session in view
    views.ts            how a result updates a provider's view
  render/
    line.ts             the line as data (pure)
    colors.ts           part -> tone -> theme colour
    StatusLine.tsx      the Solid components
  session/
    model.ts            the session's model
    cache.ts            cache stats of the last step
  refresh/
    lifecycle.ts        when to reload (timer, events, recovery)
    throttle.ts
```

`providers/` knows nothing of the TUI. `render/line.ts` is pure. Only `tui.tsx`
and `render/StatusLine.tsx` touch the plugin API.

### Adding a provider

1. Create `src/providers/<id>/` with `fetch.ts`, `parse.ts` and `index.ts`,
   exporting a `ProxyProvider` (or a `DirectProvider` when there is no URL).
2. Add it to `src/providers/index.ts`.
3. Add its URL under `options.providers` in `cli.json`.

## Development

```sh
pnpm install
pnpm run build        # tsc, then every .tsx compiled for OpenTUI's Solid renderer
pnpm run typecheck
bun test tests
```

opencode watches `dist/` and reloads the plugin after each build.
