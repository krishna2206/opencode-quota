/** Every quota provider the plugin knows. Adding one: a folder, then a line here. */

import { antigravityProvider } from "./antigravity/index.js";
import { claudeCodeProvider } from "./claude-code/index.js";
import { codexProvider } from "./codex/index.js";
import { commandCodeProvider } from "./commandcode/index.js";
import { opencodeGoProvider } from "./opencode-go/index.js";
import type { QuotaProvider, SessionModel } from "./provider.js";
import { puterProvider } from "./puter/index.js";
import { zedProvider } from "./zed/index.js";

export const PROVIDERS: readonly QuotaProvider[] = [
  antigravityProvider,
  opencodeGoProvider,
  claudeCodeProvider,
  codexProvider,
  commandCodeProvider,
  zedProvider,
  puterProvider,
];

/** The providers holding the quota of this model (usually one, possibly none). */
export function providersFor(model: SessionModel): QuotaProvider[] {
  return PROVIDERS.filter((provider) => provider.matches(model));
}
