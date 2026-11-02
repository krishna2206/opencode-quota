import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import babel from "@babel/core";
import typescriptPreset from "@babel/preset-typescript";
import solidPreset from "babel-preset-solid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "src");
const distDir = path.join(rootDir, "dist");

// tsc keeps JSX as is (`jsx: preserve`) and emits `.jsx`; the host needs plain
// JS compiled for OpenTUI's Solid renderer. Every .tsx module is transformed
// here into the `.js` its importers already reference.
async function tsxFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return tsxFiles(full);
      return entry.name.endsWith(".tsx") ? [full] : [];
    }),
  );
  return nested.flat();
}

for (const sourcePath of await tsxFiles(srcDir)) {
  const relative = path.relative(srcDir, sourcePath).replace(/\.tsx$/, "");
  const out = path.join(distDir, relative);

  // No copy of a .tsx in dist: opencode 2 resolves the TUI entry as <dist>/tui
  // and prefers .tsx over .js, so a copied source would shadow the compiled module.
  await fs.rm(`${out}.tsx`, { force: true });

  const source = await fs.readFile(sourcePath, "utf8");
  const transformed = await babel.transformAsync(source, {
    filename: sourcePath,
    configFile: false,
    babelrc: false,
    presets: [
      [solidPreset, { moduleName: "@opentui/solid", generate: "universal" }],
      [typescriptPreset],
    ],
  });
  if (!transformed?.code) throw new Error(`Babel transform returned empty output for ${relative}.tsx`);

  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(`${out}.js`, `${transformed.code}\n`);
  await fs.rm(`${out}.jsx`, { force: true });
  await fs.rm(`${out}.jsx.map`, { force: true });
}
