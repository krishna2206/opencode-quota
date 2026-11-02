/** Command Code: the account behind commandcode-proxy. */

import { transientFailure } from "../errors.js";
import { normalizeModel, type ProxyProvider } from "../provider.js";
import { fetchCommandCodeQuota } from "./fetch.js";
import { COMMANDCODE_LABEL, parseCommandCodeQuota } from "./parse.js";

export const commandCodeProvider: ProxyProvider = {
  id: "commandcode-proxy",
  label: COMMANDCODE_LABEL,
  kind: "proxy",

  matches(model) {
    const { providerID, modelID } = normalizeModel(model);
    return (
      providerID === "commandcode-proxy" ||
      providerID === "commandcode" ||
      modelID.startsWith("commandcode-proxy/") ||
      modelID.startsWith("commandcode-")
    );
  },

  async load({ url, timeoutMs }) {
    const result = await fetchCommandCodeQuota(url, timeoutMs);
    return result.ok ? parseCommandCodeQuota(result.data) : transientFailure(result.error);
  },
};
