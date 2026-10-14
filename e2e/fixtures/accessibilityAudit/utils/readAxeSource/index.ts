import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

/** Reads axe-core's browser bundle from the installed package, to run inside a page. */
export const readAxeSource = (): string =>
  readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
