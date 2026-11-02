/** Test helpers: a fake proxy behind `fetch`, recording the URLs asked. */

import { afterEach } from "bun:test";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Serve every request with `handler`; returns the URLs requested. */
export function fakeProxy(handler: (url: string) => Response | Promise<Response>): string[] {
  const urls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    urls.push(url);
    return handler(url);
  }) as typeof fetch;
  return urls;
}

/** A proxy that is not running. */
export function proxyDown(): void {
  globalThis.fetch = (async () => {
    throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
  }) as unknown as typeof fetch;
}

export const LOAD = { url: "http://127.0.0.1:9999", timeoutMs: 1_000 } as const;
