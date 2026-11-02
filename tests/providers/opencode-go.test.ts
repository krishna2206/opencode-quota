import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { opencodeGoProvider } from "../../src/providers/opencode-go/index.js";
import { parseOpenCodeGoUsage } from "../../src/providers/opencode-go/parse.js";

const NOW = Date.parse("2099-01-01T00:00:00.000Z");

describe("OpenCode Go", () => {
  it("matches the opencode-go provider only", () => {
    expect(opencodeGoProvider.matches({ providerID: "opencode-go" })).toBe(true);
    expect(opencodeGoProvider.matches({ providerID: "opencode" })).toBe(false);
  });

  it("maps the rolling and weekly windows, leaving the monthly one out", () => {
    expect(parseOpenCodeGoUsage({
      rolling: { usagePercent: 12, resetInSec: 3_600 },
      weekly: { usagePercent: 30, resetInSec: 86_400 },
      monthly: { usagePercent: 45, resetInSec: 864_000 },
    }, NOW)).toEqual({
      ok: true,
      quotas: [{ kind: "window", windows: [
        { span: "5h", remainingPercent: 88, resetAt: "2099-01-01T01:00:00.000Z" },
        { span: "7d", remainingPercent: 70, resetAt: "2099-01-02T00:00:00.000Z" },
      ] }],
    });
  });

  it("reports a dashboard without the windows it shows", () => {
    expect(parseOpenCodeGoUsage({ monthly: { usagePercent: 45, resetInSec: 10 } }, NOW))
      .toEqual({ ok: false, error: "no usage windows on the dashboard" });
  });

  describe("credentials", () => {
    let configHome: string;
    const saved = { ...process.env };

    beforeEach(() => {
      configHome = mkdtempSync(join(tmpdir(), "opencode-quota-"));
      process.env.XDG_CONFIG_HOME = configHome;
      delete process.env.OPENCODE_GO_WORKSPACE_ID;
      delete process.env.OPENCODE_GO_AUTH_COOKIE;
    });

    afterEach(() => {
      process.env = { ...saved };
      rmSync(configHome, { recursive: true, force: true });
    });

    it("says it is not configured without quota.json or environment", async () => {
      expect(await opencodeGoProvider.load({ model: { providerID: "opencode-go" }, timeoutMs: 1_000 }))
        .toEqual({ ok: false, error: "not configured" });
    });

    it("names the missing half of the credentials", async () => {
      process.env.OPENCODE_GO_WORKSPACE_ID = "wrk_1";
      expect(await opencodeGoProvider.load({ model: { providerID: "opencode-go" }, timeoutMs: 1_000 }))
        .toEqual({ ok: false, error: "missing OPENCODE_GO_AUTH_COOKIE" });
    });
  });
});
