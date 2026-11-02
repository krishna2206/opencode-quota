/**
 * OpenCode Go: scrapes the workspace dashboard on opencode.ai. A direct
 * provider: no proxy URL, but credentials (see credentials.ts).
 */

import { failure, MESSAGES, transientFailure } from "../errors.js";
import { normalizeModel, type DirectProvider } from "../provider.js";
import { resolveCredentials } from "./credentials.js";
import { fetchOpenCodeGoWithRetry, OPENCODE_GO_SCRAPE_TIMEOUT_MS } from "./fetch.js";
import { OPENCODE_GO_LABEL, parseOpenCodeGoUsage } from "./parse.js";

export const opencodeGoProvider: DirectProvider = {
  id: "opencode-go",
  label: OPENCODE_GO_LABEL,
  kind: "direct",

  matches(model) {
    return normalizeModel(model).providerID === "opencode-go";
  },

  async load({ timeoutMs }) {
    const resolved = await resolveCredentials();
    if (resolved.state === "missing") return failure(MESSAGES.notConfigured);
    if (resolved.state === "invalid") return failure(resolved.error);
    if (resolved.state === "incomplete") return failure(`missing ${resolved.missing}`);

    const result = await fetchOpenCodeGoWithRetry({
      ...resolved.credentials,
      timeoutMs: Math.max(2_000, Math.min(timeoutMs, OPENCODE_GO_SCRAPE_TIMEOUT_MS)),
    });
    return result.ok ? parseOpenCodeGoUsage(result.data, Date.now()) : transientFailure(result.error);
  },
};
