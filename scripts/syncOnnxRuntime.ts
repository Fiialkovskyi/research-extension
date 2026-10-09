/**
 * Copies the ONNX Runtime WebAssembly binaries into the package's public
 * directory, so the add-on executes only code it ships (REQ-RT-006).
 *
 * Run before every build and before the dev server. The copies are generated
 * output, not source: they are ignored by git and rebuilt from whatever
 * `onnxruntime-web` version `@huggingface/transformers` currently pins, so a
 * dependency bump cannot leave a stale binary behind.
 */

import { createRequire } from "node:module";
import { copyFile, mkdir, readdir, stat, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  ONNX_RUNTIME_DIRECTORY,
  ONNX_RUNTIME_WASM_VARIANTS,
} from "../src/shared/config/onnxRuntime";

const require = createRequire(import.meta.url);

/** Extensions each variant needs: the loader module and the binary itself. */
const REQUIRED_EXTENSIONS = ["mjs", "wasm"] as const;

// The package does not export its own `package.json`, so we resolve its
// entry point instead and take the directory holding it — which is the
// `dist` directory the binaries sit in. Going through node resolution
// rather than a hard-coded `node_modules` path keeps this working whether
// or not the dependency is hoisted.
const distributionDirectory = dirname(require.resolve("onnxruntime-web"));
const destinationDirectory = resolve(import.meta.dirname, "..", "public", ONNX_RUNTIME_DIRECTORY);

await mkdir(destinationDirectory, { recursive: true });

const variantStems = [...new Set(Object.values(ONNX_RUNTIME_WASM_VARIANTS))];
const wantedFiles = variantStems.flatMap((stem) =>
  REQUIRED_EXTENSIONS.map((extension) => `${stem}.${extension}`),
);

const copiedSizes = await Promise.all(
  wantedFiles.map(async (fileName) => {
    const source = join(distributionDirectory, fileName);

    // A missing file means the runtime renamed or dropped a build variant.
    // Failing loudly here is the point: the alternative is an add-on that
    // silently falls back to fetching the binary from a CDN at runtime.
    const { size } = await stat(source).catch(() => {
      throw new Error(
        `ONNX Runtime build variant not found: ${fileName}. ` +
          `Check which variants onnxruntime-web ships in ${distributionDirectory} ` +
          `and update ONNX_RUNTIME_WASM_VARIANTS to match.`,
      );
    });

    await copyFile(source, join(destinationDirectory, fileName));
    return size;
  }),
);

const copiedBytes = copiedSizes.reduce((total, size) => total + size, 0);

// Anything else in the directory is a variant we no longer ship. Removed rather
// than left: these files are tens of megabytes each, and a variant change would
// otherwise carry the old one into the package forever.
const wanted = new Set(wantedFiles);
const present = await readdir(destinationDirectory);
const stale = present.filter((fileName) => !wanted.has(fileName));

await Promise.all(stale.map((fileName) => unlink(join(destinationDirectory, fileName))));

if (stale.length > 0) {
  console.log(`ONNX Runtime: removed ${stale.length} file(s) from a variant no longer shipped`);
}

const megabytes = (copiedBytes / 1_000_000).toFixed(1);
console.log(`ONNX Runtime: copied ${megabytes} MB into public/${ONNX_RUNTIME_DIRECTORY}/`);
