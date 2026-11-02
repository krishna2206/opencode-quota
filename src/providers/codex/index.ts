/** Codex: the ChatGPT accounts behind codex-proxy. */

import { transientFailure } from "../errors.js";
import { normalizeModel, type ProxyProvider } from "../provider.js";
import { fetchCodexQuota } from "./fetch.js";
import { CODEX_LABEL, parseCodexQuota } from "./parse.js";

export const codexProvider: ProxyProvider = {
  id: "codex-proxy",
  label: CODEX_LABEL,
  kind: "proxy",

  matches(model) {
    const { providerID, modelID } = normalizeModel(model);
    return providerID === "codex-proxy" || providerID === "codex" || modelID.startsWith("codex-proxy/") || modelID.startsWith("codex-");
  },

  async load({ url, timeoutMs }) {
    const result = await fetchCodexQuota(url, timeoutMs);
    return result.ok ? parseCodexQuota(result.data) : transientFailure(result.error);
  },
};
