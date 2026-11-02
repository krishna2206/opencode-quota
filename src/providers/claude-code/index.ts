/** Claude Code: the Claude subscription behind claude-code-proxy. */

import { transientFailure } from "../errors.js";
import { normalizeModel, type ProxyProvider } from "../provider.js";
import { fetchClaudeCodeQuota } from "./fetch.js";
import { CLAUDE_CODE_LABEL, parseClaudeCodeQuota } from "./parse.js";

export const claudeCodeProvider: ProxyProvider = {
  id: "claude-code-proxy",
  label: CLAUDE_CODE_LABEL,
  kind: "proxy",

  matches(model) {
    const { providerID, modelID } = normalizeModel(model);
    return providerID === "claude-code-proxy" || providerID === "claude-local" || modelID.startsWith("claude-code-proxy/");
  },

  async load({ url, timeoutMs }) {
    const result = await fetchClaudeCodeQuota(url, timeoutMs);
    return result.ok ? parseClaudeCodeQuota(result.data) : transientFailure(result.error);
  },
};
