/** Puter: the accounts behind puter-proxy. */

import { transientFailure } from "../errors.js";
import { normalizeModel, type ProxyProvider } from "../provider.js";
import { fetchPuterQuota } from "./fetch.js";
import { parsePuterQuota, PUTER_LABEL } from "./parse.js";

export const puterProvider: ProxyProvider = {
  id: "puter",
  label: PUTER_LABEL,
  kind: "proxy",

  matches(model) {
    const { providerID, modelID } = normalizeModel(model);
    return (
      providerID === "puter" ||
      providerID === "opencode-puter" ||
      modelID.startsWith("puter/") ||
      modelID.startsWith("opencode-puter/")
    );
  },

  async load({ url, timeoutMs }) {
    const result = await fetchPuterQuota(url, timeoutMs);
    return result.ok ? parsePuterQuota(result.data) : transientFailure(result.error);
  },
};
