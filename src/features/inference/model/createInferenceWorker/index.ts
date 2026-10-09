import * as v from "valibot";

import { buildRpcMessage, parseRpcMessage, RpcMessageError } from "@/shared/rpc";
import { INFERENCE_REQUEST_TIMEOUT_MS } from "../../constants";
import { workerRequestSchemas, workerResponseSchemas } from "../../schemas";
import type { InferenceWorker, PendingRequest, WorkerResponse } from "./types";

export type { InferenceWorker };

/**
 * Spawns the inference worker and wraps it in a request/response channel.
 *
 * Correlating by message id matters because several requests can be outstanding
 * at once — a benchmark batch while the user triggers a probe, say — and a
 * worker is free to answer them out of order. Without correlation the caller
 * would have to assume ordering the protocol does not promise.
 *
 * @param workerUrl loadable URL of the packaged worker script. Resolved by the
 *   caller, so this channel needs no extension runtime to be exercised.
 */
export const createInferenceWorker = (workerUrl: string): InferenceWorker => {
  const worker = new Worker(workerUrl, { type: "module" });
  const pending = new Map<string, PendingRequest>();

  const settle = (id: string): PendingRequest | undefined => {
    const entry = pending.get(id);

    if (entry !== undefined) {
      clearTimeout(entry.timer);
      pending.delete(id);
    }

    return entry;
  };

  /** Fails every outstanding request: a dead worker will answer none of them. */
  const rejectAll = (reason: Error): void => {
    // Snapshot the ids first: settling removes entries as we go.
    for (const id of Array.from(pending.keys())) {
      settle(id)?.reject(reason);
    }
  };

  worker.addEventListener("message", (event: MessageEvent<unknown>) => {
    let response: WorkerResponse;

    try {
      response = parseRpcMessage(event.data, workerResponseSchemas);
    } catch (error) {
      // A message we cannot validate cannot be correlated either, so there is
      // no single caller to fail. Dropping it keeps one malformed message from
      // taking down unrelated in-flight requests.
      if (error instanceof RpcMessageError) {
        return;
      }

      throw error;
    }

    const entry = settle(response.id);

    if (entry === undefined) {
      return;
    }

    if (response.type === "worker.error") {
      entry.reject(
        new Error(
          `Inference worker failed "${response.payload.requestType}": ${response.payload.reason}`,
        ),
      );
      return;
    }

    entry.resolve(response);
  });

  worker.addEventListener("error", (event: ErrorEvent) => {
    rejectAll(new Error(`Inference worker crashed: ${event.message || "no message"}`));
  });

  return {
    request: (type, payload) =>
      new Promise<WorkerResponse>((resolve, reject) => {
        // A typo in a payload is caught here, at the call that made it, rather
        // than as a refusal from the worker some time later.
        const checked = v.safeParse(workerRequestSchemas[type], payload);

        if (!checked.success) {
          reject(
            new Error(
              `Could not send "${type}" to the inference worker: ${checked.issues[0]?.message ?? "the payload is invalid"}.`,
            ),
          );
          return;
        }

        const message = buildRpcMessage(type, payload);

        pending.set(message.id, {
          resolve,
          reject,
          timer: setTimeout(() => {
            settle(message.id);
            reject(new Error(`Inference worker did not answer "${type}" in time`));
          }, INFERENCE_REQUEST_TIMEOUT_MS),
        });

        worker.postMessage(message);
      }),
    terminate: () => {
      rejectAll(new Error("Inference worker was terminated"));
      worker.terminate();
    },
  };
};
