import { afterEach, describe, expect, it } from "bun:test";
import type { DirectProvider, ProxyProvider } from "../src/providers/provider.js";
import { loadProvider } from "../src/quota/load.js";

const urls: string[] = [];

const proxy: ProxyProvider = {
  id: "demo-proxy",
  label: "Demo",
  kind: "proxy",
  matches: () => true,
  load: async ({ url }) => {
    urls.push(url);
    return { ok: true, quotas: [] };
  },
};

afterEach(() => {
  urls.length = 0;
  delete process.env.OPENCODE_QUOTA_DEMO_PROXY_URL;
});

describe("Running a provider", () => {
  it("never calls an unconfigured proxy provider", async () => {
    expect(await loadProvider(proxy, { model: {}, options: {}, timeoutMs: 1_000 })).toEqual({ ok: false, error: "not configured" });
    expect(urls).toEqual([]);
  });

  it("hands the configured URL to the provider", async () => {
    const options = { providers: { "demo-proxy": { url: "http://127.0.0.1:7000/" } } };
    expect(await loadProvider(proxy, { model: {}, options, timeoutMs: 1_000 })).toEqual({ ok: true, quotas: [] });
    expect(urls).toEqual(["http://127.0.0.1:7000"]);
  });

  it("prefers the environment variable over the options", async () => {
    process.env.OPENCODE_QUOTA_DEMO_PROXY_URL = "http://127.0.0.1:7450";
    const options = { providers: { "demo-proxy": { url: "http://127.0.0.1:7000" } } };
    await loadProvider(proxy, { model: {}, options, timeoutMs: 1_000 });
    expect(urls).toEqual(["http://127.0.0.1:7450"]);
  });

  it("turns a provider that throws into a transient error on the line", async () => {
    const broken: DirectProvider = {
      id: "broken", label: "Broken", kind: "direct", matches: () => true,
      load: async () => { throw new Error("boom"); },
    };
    expect(await loadProvider(broken, { model: {}, options: {}, timeoutMs: 1_000 }))
      .toEqual({ ok: false, error: "unexpected error: boom", transient: true });
  });
});
