import { env, pipeline } from "@huggingface/transformers";

import type { InferenceDevice, ModelManifest } from "@/shared/modelManifest";
import type { EmbedResult, LoadedModel } from "../../constants";
import {
  createModelFileCache,
  type ModelFileCache,
  type ModelFileContents,
} from "../createModelFileCache";
import { getOnnxRuntimeWasmPaths } from "../getOnnxRuntimeWasmPaths";
import { getModelDtype } from "./utils/getModelDtype";
import { getPoolingStrategy } from "./utils/getPoolingStrategy";
import { getPrefixedTexts } from "./utils/getPrefixedTexts";
import { splitEmbeddingRows } from "./utils/splitEmbeddingRows";

/**
 * Where a cache miss looks before giving up.
 *
 * Deliberately a path the package does not contain: the lookup is a dead end
 * inside our own origin, which is what makes it safe for local loading to stay
 * enabled.
 */
const LOCAL_MODEL_PATH = "/models/";

export interface LoadModelOptions {
  manifest: ModelManifest;
  /** Verified files, as the background read them out of storage. */
  files: readonly ModelFileContents[];
  /** Compute path to run on, chosen by the caller from the reported capabilities. */
  device: InferenceDevice;
  /** Base URL the packaged runtime binaries resolve against. */
  packageBase: string;
}

/** A local runtime a model can be loaded into. */
export interface InferenceProvider {
  /** Which runtime this is, recorded with every result's provenance. */
  readonly kind: "ext-ort";
  load: (options: LoadModelOptions) => Promise<LoadedModel>;
}

/**
 * Points the runtime at our binaries and our verified files.
 *
 * Two settings carry the whole security argument. The cache serves only files
 * the install pipeline verified, and remote loading is switched **off**, so a
 * file the cache does not hold fails the load instead of being fetched
 * unchecked. The runtime consults its cache before it consults that switch,
 * which is what makes the pairing work rather than merely sound strict.
 */
const configureRuntime = (options: LoadModelOptions): ModelFileCache => {
  const wasm = env.backends.onnx.wasm;

  if (wasm === undefined) {
    throw new Error(
      "The model runtime exposes no WebAssembly backend to configure. " +
        "Without it the runtime would resolve its binaries from a public CDN, " +
        "which this package neither permits nor relies on.",
    );
  }

  const cache = createModelFileCache(options.manifest.reference, options.files);

  env.useCustomCache = true;
  env.customCache = cache;
  // Our cache is the only source. The browser cache could hold unverified bytes
  // from an earlier session and is not ours to trust.
  env.useBrowserCache = false;
  // Remote loading off is the setting that matters: a file our cache does not
  // hold must fail the load, never arrive unverified.
  env.allowRemoteModels = false;
  // Local loading stays on, which looks like the opposite of what we want and
  // is not. The library refuses outright when both are off — it throws
  // "both local and remote models are disabled" before it ever consults a
  // cache — so one of them has to be true. Local is the harmless one: a cache
  // miss then resolves against `localModelPath` inside the extension's own
  // origin, finds nothing, and the miss still ends as a failed load because
  // remote loading is off. Nothing leaves the package either way.
  env.allowLocalModels = true;
  env.localModelPath = LOCAL_MODEL_PATH;

  // Switched off deliberately. With `wasmPaths` given as an object, the library
  // pre-loads the binary and then replaces the loader path with a `blob:` URL
  // that it dynamically imports — which the package's `script-src` refuses, and
  // should: permitting `blob:` would let any code in this origin assemble and
  // run a script. Off, the loader is imported straight from the package, which
  // is `'self'`, and the binary is fetched from the packaged path. The failure
  // it otherwise produces says only "no available backend found".
  env.useWasmCache = false;

  wasm.wasmPaths = getOnnxRuntimeWasmPaths(
    options.device === "webgpu" ? "webgpu" : "wasm",
    options.packageBase,
  );
  // One thread, stated rather than discovered. Extension pages are never
  // cross-origin isolated, so SharedArrayBuffer is absent and the runtime would
  // otherwise ask for threads, find none, and fall back in silence.
  wasm.numThreads = 1;

  return cache;
};

/**
 * The in-extension provider: the model runtime running inside our own worker.
 *
 * Everything here is configuration and glue. The parts worth reasoning about —
 * which weight variant to request, which pooling to apply, how to cut a batch
 * apart — live in `utils/` where they carry tests, because this module cannot
 * be exercised without loading real WebAssembly.
 */
export const createExtOrtProvider = (): InferenceProvider => {
  return {
    kind: "ext-ort",
    load: async (options) => {
      const { manifest, device } = options;

      const cache = configureRuntime(options);

      if (manifest.contract.family !== "embedding") {
        // Generation arrives with phase B. The contract already describes it,
        // so adding it will not reshape this interface.
        throw new Error(`This provider cannot yet load a "${manifest.contract.family}" model.`);
      }

      const { contract } = manifest;
      const pooling = getPoolingStrategy(contract);
      const extractor = await pipeline("feature-extraction", manifest.reference.repository, {
        revision: manifest.reference.revision,
        dtype: getModelDtype(manifest.quantization),
        device: device === "webgpu" ? "webgpu" : "wasm",
      }).catch((error: unknown) => {
        // The runtime's own message for a cache miss names only the local path
        // it checked last, which is never where the files are. Saying what it
        // asked for beside what we hold turns that into something actionable.
        throw new Error(
          `${error instanceof Error ? error.message : String(error)}\n` +
            `The runtime asked for: ${cache.misses.join(", ") || "nothing"}\n` +
            `This model holds: ${cache.keys.join(", ")}`,
        );
      });

      return {
        family: "embedding",
        manifest,
        device,
        embed: async (request): Promise<EmbedResult> => {
          const prefixed = getPrefixedTexts(contract, request.role, request.texts);

          if (prefixed.length === 0) {
            return { vectors: [], device };
          }

          const output = await extractor(prefixed, { pooling, normalize: contract.normalize });

          return {
            vectors: splitEmbeddingRows(
              output.data as Float32Array,
              prefixed.length,
              contract.dimensions,
            ),
            device,
          };
        },
        unload: async () => {
          await extractor.dispose();
        },
      };
    },
  };
};
