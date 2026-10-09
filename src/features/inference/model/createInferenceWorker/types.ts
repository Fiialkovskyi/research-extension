import type { ParsedRpcMessage } from "@/shared/rpc";

import type { workerResponseSchemas } from "../../schemas";
import type { WorkerRequestType } from "../../types";

/** A response the worker may send back, validated before a caller sees it. */
export type WorkerResponse = ParsedRpcMessage<typeof workerResponseSchemas>;

/** A live worker, with requests correlated to their responses. */
export interface InferenceWorker {
  /**
   * Sends a request and resolves with the worker's correlated response.
   *
   * @throws when the worker reports an error, dies, or does not answer in time.
   */
  request: (type: WorkerRequestType, payload: unknown) => Promise<WorkerResponse>;
  terminate: () => void;
}

export interface PendingRequest {
  resolve: (response: WorkerResponse) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
