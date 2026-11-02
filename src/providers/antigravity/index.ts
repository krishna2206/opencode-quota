/** Antigravity: the quota pool behind the session's model, from antigravity-proxy. */

import { transientFailure } from "../errors.js";
import { normalizeModel, type ProxyProvider } from "../provider.js";
import { fetchPool } from "./fetch.js";
import { ANTIGRAVITY_LABEL, parsePool } from "./parse.js";

export const antigravityProvider: ProxyProvider = {
  id: "antigravity-proxy",
  label: ANTIGRAVITY_LABEL,
  kind: "proxy",

  matches(model) {
    return normalizeModel(model).providerID === "antigravity-proxy";
  },

  async load({ url, model, timeoutMs }) {
    const result = await fetchPool(url, model.modelID ?? "", timeoutMs);
    return result.ok ? parsePool(result.data) : transientFailure(result.error);
  },
};
