import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the worker's isolation statically.
 *
 * The worker must stay free of extension APIs: it runs in a realm where
 * `browser.*` is unavailable, and reaching for it would fail at runtime rather
 * than at build time. Checking the source keeps that contract enforced as the
 * file grows, which a behavioural test of the message handler would not.
 */
// Resolved from the project root: under Vite, `import.meta.url` is a served
// URL rather than a file path.
const workerSource = await readFile(
  resolve(process.cwd(), "src/entrypoints/inferenceWorker/index.ts"),
  "utf8",
);

describe("inference worker module", () => {
  it.each(["browser.", "chrome.", "wxt/browser"])(
    "does not reach for the extension API via %s",
    (forbidden) => {
      expect(workerSource).not.toContain(forbidden);
    },
  );

  it("does not import from the storage layer, which the background owns", () => {
    expect(workerSource).not.toContain("shared/storage");
  });

  it("registers its listener synchronously inside the entrypoint's main", () => {
    expect(workerSource).toContain("self.addEventListener");
  });

  it("answers over postMessage rather than returning a value", () => {
    expect(workerSource).toContain("self.postMessage");
  });
});
