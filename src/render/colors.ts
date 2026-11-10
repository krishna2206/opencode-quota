/**
 * The colour of each part of the line: a tone decided from the numbers
 * (pure, tested), then the theme colour of that tone.
 */

import type { Plugin } from "@opencode/plugin/tui";
import type { RGBA } from "@opentui/core";
import type { Part } from "./line.js";

export type Tone = "success" | "warning" | "error" | "muted";

type Theme = Plugin.Context["theme"];

export function tone(part: Part): Tone {
  switch (part.kind) {
    case "window":
      // Remaining share of a subscription window.
      if (part.remainingPercent >= 50) return "success";
      return part.remainingPercent >= 20 ? "warning" : "error";
    case "tokens":
      // USD spend: warn late, money runs out fast at the end.
      if (part.usedRatio >= 0.95) return "error";
      return part.usedRatio >= 0.8 ? "warning" : "success";
    case "credits":
      if (part.usedRatio >= 0.8) return "error";
      return part.usedRatio >= 0.5 ? "warning" : "success";
    case "cache":
      if (part.hitRatio >= 50) return "success";
      return part.hitRatio > 0 ? "warning" : "muted";
    case "error":
      return "error";
    case "stale":
      return "warning";
    case "label":
    case "separator":
    case "pending":
      return "muted";
  }
}

export function toneColor(theme: Theme, value: Tone): RGBA {
  return value === "muted" ? theme.text.muted : theme.text.feedback[value].base;
}
