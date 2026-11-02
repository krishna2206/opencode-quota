/** Claude Code: GET <url>/api/quota on claude-code-proxy (one subscription, 5h and 7d). */

import { describeFetchError, httpError, MESSAGES } from "../errors.js";
import type { Fetched } from "../provider.js";

export interface ClaudeCodeWindow {
  status: string;
  utilization: number;
  utilizationPercent: number;
  remainingPercent: number;
  resetsAtIso?: string | null;
  resetsInSeconds?: number | null;
}

export interface ClaudeCodeQuota {
  status: "ok" | "unavailable";
  organizationId?: string | null;
  workspaceId?: string | null;
  fiveHour?: ClaudeCodeWindow | null;
  sevenDay?: ClaudeCodeWindow | null;
  lastUpdatedIso?: string | null;
}

export async function fetchClaudeCodeQuota(url: string, timeoutMs: number): Promise<Fetched<ClaudeCodeQuota>> {
  let response: Response;
  try {
    response = await fetch(`${url}/api/quota`, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    return { ok: false, error: describeFetchError(error) };
  }
  if (!response.ok) return { ok: false, error: httpError(response.status) };

  try {
    return { ok: true, data: (await response.json()) as ClaudeCodeQuota };
  } catch {
    return { ok: false, error: MESSAGES.invalidResponse };
  }
}
