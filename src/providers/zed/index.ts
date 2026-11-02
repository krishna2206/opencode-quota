/** Zed: the account behind zed-proxy. */

import { transientFailure } from "../errors.js";
import { normalizeModel, type ProxyProvider } from "../provider.js";
import { fetchZedQuota } from "./fetch.js";
import { parseZedQuota, ZED_LABEL } from "./parse.js";

export const zedProvider: ProxyProvider = {
  id: "zed-proxy",
  label: ZED_LABEL,
  kind: "proxy",

  matches(model) {
    const { providerID, modelID } = normalizeModel(model);
    return providerID === "zed-proxy" || providerID === "zed" || modelID.startsWith("zed-proxy/") || modelID.startsWith("zed/");
  },

  async load({ url, timeoutMs }) {
    const result = await fetchZedQuota(url, timeoutMs);
    return result.ok ? parseZedQuota(result.data) : transientFailure(result.error);
  },
};
