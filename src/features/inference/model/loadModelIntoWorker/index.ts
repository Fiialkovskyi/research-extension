import type { IDBPDatabase } from "idb";

import type { InferenceDevice } from "@/shared/modelManifest";
import { MODEL_FILE_STORE, type ModelDatabaseSchema, type StoredModel } from "@/shared/storage";
import type { EmbeddingRole } from "../../constants";
import type { InferenceWorker } from "../createInferenceWorker";

/** A model loaded in the worker, with a way to use it. */
export interface WorkerModelSession {
  /** The device that actually loaded it, which may not be the one requested. */
  device: InferenceDevice;
  /** Declared width, for an encoder. */
  dimensions?: number;
  /** How long loading took, which is worth reporting separately from inference. */
  loadDurationMs: number;
  embed: (texts: readonly string[], role: EmbeddingRole) => Promise<Float32Array[]>;
}

export interface LoadModelIntoWorkerOptions {
  model: StoredModel;
  database: IDBPDatabase<ModelDatabaseSchema>;
  worker: InferenceWorker;
  device: InferenceDevice;
}

/**
 * Hands a stored model to the worker and returns a way to run it.
 *
 * The bytes travel in the message rather than being read by the worker,
 * because storage belongs to the background. That is not only a layering
 * preference: it means the worker can be replaced, restarted or run against a
 * stub without any of them needing access to the database.
 *
 * @throws when the model's files are missing from storage, or when the worker
 *   refuses the load.
 */
export const loadModelIntoWorker = async (
  options: LoadModelIntoWorkerOptions,
): Promise<WorkerModelSession> => {
  const { model, database, worker, device } = options;
  const stored = await database.getAllFromIndex(MODEL_FILE_STORE, "ref", model.ref);
  const byPath = new Map(stored.map((file) => [file.path, file.contents]));

  const files = model.manifest.files.map((file) => {
    const contents = byPath.get(file.path);

    if (contents === undefined) {
      throw new Error(
        `"${file.path}" is missing from storage for ${model.ref}, so the model cannot be loaded. ` +
          `Reinstalling it will fetch and verify the file again.`,
      );
    }

    return { path: file.path, contents };
  });

  const loaded = await worker.request("model.load", { manifest: model.manifest, files, device });

  if (loaded.type !== "model.loaded") {
    throw new Error(`The worker answered a load with "${loaded.type}".`);
  }

  return {
    device: loaded.payload.device,
    dimensions: loaded.payload.dimensions,
    loadDurationMs: loaded.payload.loadDurationMs,
    embed: async (texts, role) => {
      const embedded = await worker.request("infer.embed", { texts: [...texts], role });

      if (embedded.type !== "infer.embedded") {
        throw new Error(`The worker answered an embedding request with "${embedded.type}".`);
      }

      return embedded.payload.vectors;
    },
  };
};
