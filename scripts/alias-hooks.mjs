// Module resolve hook so plain `node` can run app modules that use the "@/…"
// path alias and extensionless imports — both tsconfig conventions Node does
// not know about.
//
// Node 24 strips TypeScript types natively, so with this hook a script can
// import lib/** directly: no bundler, no tsx, no build step. Used by
// scripts/gen-doc-prompts.mjs.

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = pathToFileURL(process.cwd() + "/").href;
const EXTS = [".ts", ".tsx", ".mts", ".js", ".mjs"];

/** Add an extension (or /index.*) if the path doesn't resolve as-is. */
function withExtension(url) {
  const p = fileURLToPath(url);
  if (existsSync(p) && !p.endsWith("/")) return url;
  for (const e of EXTS) if (existsSync(p + e)) return url + e;
  for (const e of EXTS) if (existsSync(`${p}/index${e}`)) return `${url}/index${e}`;
  return url;
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith("@/"))
    return next(withExtension(new URL(specifier.slice(2), ROOT).href), context);

  // Relative imports inside those modules are extensionless too.
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const abs = new URL(specifier, context.parentURL).href;
    const fixed = withExtension(abs);
    if (fixed !== abs) return next(fixed, context);
  }
  return next(specifier, context);
}
