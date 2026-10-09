import { defineUnlistedScript } from "wxt/utils/define-unlisted-script";

import { type LoadedModel, workerRequestSchemas } from "@/features/inference/constants";
import { getRuntimeCapabilities } from "@/features/inference/model/getRuntimeCapabilities";
import { getErrorMessage } from "@/shared/getErrorMessage";
import { buildRpcMessage, parseRpcMessage, readMessageField } from "@/shared/rpc";

/**
 * The inference worker.
 *
 * Runs model loading and inference off every document's main thread. It
 * deliberately touches no extension API: work arrives over `postMessage` and
 * answers leave the same way, which keeps the background the only context that
 * talks to the browser and keeps this file testable by inspection.
 *
 * It also does not read storage. The background owns that and sends the
 * verified bytes along with the load request, which transfers them without a
 * copy.
 *
 * Wiring only — dispatch and reply. What it calls lives in
 * `features/inference`, where it carries unit tests.
 */

/** One model at a time. A second load replaces the first rather than adding to it. */
let loaded: LoadedModel | undefined;

/** Replies under the id of the request being answered, so the caller can match it. */
const reply = (id: string, type: string, payload: unknown): void => {
  self.postMessage({ ...buildRpcMessage(type, payload), id });
};

/** The GPU surface, where the platform exposes one. */
const readGpu = (): { requestAdapter: () => Promise<unknown> } | undefined => {
  return (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
};

/** The package root, which the packaged runtime binaries resolve against. */
const getPackageBase = (): string => {
  return new URL("./", self.location.href).href;
};

export default defineUnlistedScript(() => {
  self.addEventListener("message", (event: MessageEvent<unknown>) => {
    void (async () => {
      // Recovered defensively: a message we cannot validate still has to be
      // answered, or the caller waits for a reply that never arrives.
      const messageId = readMessageField(event.data, "id") ?? "unknown";

      try {
        const request = parseRpcMessage(event.data, workerRequestSchemas);

        switch (request.type) {
          case "worker.ping": {
            reply(
              messageId,
              "worker.pong",
              await getRuntimeCapabilities(readGpu(), self.crossOriginIsolated),
            );
            return;
          }

          case "model.load": {
            // Imported here rather than at the top so a capability probe does
            // not pay to load the model runtime, which is by far the largest
            // thing in the package.
            const { createExtOrtProvider } =
              await import("@/features/inference/model/createExtOrtProvider");

            await loaded?.unload();
            loaded = undefined;

            const startedAt = performance.now();

            loaded = await createExtOrtProvider().load({
              manifest: request.payload.manifest,
              files: request.payload.files,
              device: request.payload.device,
              packageBase: getPackageBase(),
            });

            reply(messageId, "model.loaded", {
              device: loaded.device,
              dimensions:
                loaded.manifest.contract.family === "embedding"
                  ? loaded.manifest.contract.dimensions
                  : undefined,
              loadDurationMs: performance.now() - startedAt,
            });
            return;
          }

          case "infer.embed": {
            if (loaded === undefined) {
              throw new Error("No model is loaded.");
            }

            if (loaded.family !== "embedding") {
              throw new Error(`The loaded model is a ${loaded.family} model, not an encoder.`);
            }

            const startedAt = performance.now();
            const result = await loaded.embed(request.payload);

            reply(messageId, "infer.embedded", {
              vectors: result.vectors,
              device: result.device,
              durationMs: performance.now() - startedAt,
            });
            return;
          }
        }
      } catch (error) {
        reply(messageId, "worker.error", {
          requestType: readMessageField(event.data, "type") ?? "unknown",
          reason: getErrorMessage(error),
        });
      }
    })();
  });
});
