import { describe, expect, it } from "bun:test";
import { envVarName, resolveProviderURL } from "../src/config.js";

const options = { providers: { "zed-proxy": { url: "http://127.0.0.1:7443/" } } };

describe("Provider URL resolution", () => {
  it("names the override variable after the provider id", () => {
    expect(envVarName("antigravity-proxy")).toBe("OPENCODE_QUOTA_ANTIGRAVITY_PROXY_URL");
    expect(envVarName("puter")).toBe("OPENCODE_QUOTA_PUTER_URL");
  });

  it("reads the plugin options, without a trailing slash", () => {
    expect(resolveProviderURL("zed-proxy", options, {})).toEqual({ ok: true, url: "http://127.0.0.1:7443" });
  });

  it("lets the environment override the options", () => {
    const env = { OPENCODE_QUOTA_ZED_PROXY_URL: "http://127.0.0.1:7450" };
    expect(resolveProviderURL("zed-proxy", options, env)).toEqual({ ok: true, url: "http://127.0.0.1:7450" });
  });

  it("has no default: an unconfigured provider says so", () => {
    expect(resolveProviderURL("codex-proxy", options, {})).toEqual({ ok: false, error: "not configured" });
    expect(resolveProviderURL("codex-proxy", undefined, {})).toEqual({ ok: false, error: "not configured" });
    expect(resolveProviderURL("codex-proxy", { providers: { "codex-proxy": { url: "  " } } }, {}))
      .toEqual({ ok: false, error: "not configured" });
  });

  it("rejects what is not an http(s) URL", () => {
    expect(resolveProviderURL("zed-proxy", { providers: { "zed-proxy": { url: "127.0.0.1:7443" } } }, {}))
      .toEqual({ ok: false, error: "invalid URL" });
    expect(resolveProviderURL("zed-proxy", { providers: { "zed-proxy": { url: "ftp://host" } } }, {}))
      .toEqual({ ok: false, error: "invalid URL" });
    expect(resolveProviderURL("zed-proxy", { providers: { "zed-proxy": { url: 7443 } } }, {}))
      .toEqual({ ok: false, error: "not configured" });
  });
});
