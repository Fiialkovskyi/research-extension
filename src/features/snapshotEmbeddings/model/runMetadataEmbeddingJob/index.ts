import type { IDBPDatabase } from "idb";
import * as v from "valibot";

import { getActiveModel } from "@/features/modelRegistry";
import { readStoredPageMetadata } from "@/features/pageMetadata";
import { claimSessionEmbeddingSpace } from "@/features/researchSession";
import {
  NODE_STORE,
  type ResearchDatabaseSchema,
  SPACE_STORE,
  type StoredJob,
  type StoredModel,
  VECTOR_STORE,
} from "@/shared/storage";

import { METADATA_CHUNK_PREFIX } from "../../constants";
import { embedMetadataPayloadSchema } from "../../schemas";
import type { EmbeddingSession } from "../runEmbeddingJob";
import { splitChunkForModel } from "../splitChunkForModel";

export interface RunMetadataEmbeddingJobOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  job: StoredJob;
  /** Loads the model, or returns the one already loaded. */
  loadSession: (model: StoredModel) => Promise<EmbeddingSession>;
}

/**
 * Embeds what a page says about itself — its title and description — into one
 * space as one weak vector of the node, for a page whose text has not been
 * embedded. The vector's `chunkId` is the node's id after
 * `METADATA_CHUNK_PREFIX`; clustering reads it only while the node has no vector
 * of its own text.
 *
 * Does nothing for a node that has a snapshot (its text is what is embedded),
 * has no metadata, or whose metadata has nothing to embed. Fitted to the
 * model's input limit by keeping the first part only: a title and a short
 * description are the whole of it.
 *
 * @returns How many vectors this run stored.
 * @throws When the node or space is gone, or the space's model is not the
 *   active one; the queue then retries with backoff.
 */
export const runMetadataEmbeddingJob = async ({
  database,
  job,
  loadSession,
}: RunMetadataEmbeddingJobOptions): Promise<number> => {
  const { nodeId, spaceId } = v.parse(embedMetadataPayloadSchema, job.payload);
  const [node, space, model] = await Promise.all([
    database.get(NODE_STORE, nodeId),
    database.get(SPACE_STORE, spaceId),
    getActiveModel(database, "embedding"),
  ]);

  if (node === undefined || space === undefined) {
    throw new Error(`Node "${nodeId}" or space "${spaceId}" no longer exists.`);
  }

  if (
    model?.manifest.contract.family !== "embedding" ||
    model.manifest.reference.repository !== space.model.repository ||
    model.manifest.reference.revision !== space.model.revision
  ) {
    throw new Error(`The model of space "${spaceId}" is not the active embedding model.`);
  }

  if (node.snapshotId !== undefined) {
    return 0;
  }

  const metadata = await readStoredPageMetadata(database, nodeId);
  const text = [metadata?.title ?? node.title, metadata?.description]
    .filter((part): part is string => part !== undefined && part.trim() !== "")
    .join("\n");

  if (metadata === undefined || text === "") {
    return 0;
  }

  const [part] = splitChunkForModel(text, model.manifest.contract);
  const [vector] = await (await loadSession(model)).embed([part ?? text], "document");

  await database.put(VECTOR_STORE, {
    spaceId,
    chunkId: `${METADATA_CHUNK_PREFIX}${nodeId}`,
    part: 0,
    nodeId,
    sessionId: node.sessionId,
    vector: vector ?? new Float32Array(space.dims),
  });
  await claimSessionEmbeddingSpace(database, node.sessionId, spaceId);

  return 1;
};
