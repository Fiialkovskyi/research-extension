import type { IDBPDatabase } from "idb";
import * as v from "valibot";

import { checkpointJob } from "@/features/jobQueue";
import { getActiveModel } from "@/features/modelRegistry";
import { readSnapshotText } from "@/features/pageSnapshots";
import { claimSessionEmbeddingSpace } from "@/features/researchSession";
import {
  CHUNK_STORE,
  type ResearchDatabaseSchema,
  SNAPSHOT_STORE,
  SPACE_STORE,
  type StoredChunk,
  type StoredJob,
  type StoredModel,
  VECTOR_STORE,
} from "@/shared/storage";

import { CHUNKER_VERSION, EMBEDDING_BATCH_SIZE } from "../../constants";
import { embedSnapshotCheckpointSchema, embedSnapshotPayloadSchema } from "../../schemas";
import { chunkText } from "../chunkText";
import { splitChunkForModel } from "../splitChunkForModel";

/** A loaded embedding model: embeds texts in one role, applying the model's prefix. */
export interface EmbeddingSession {
  embed: (texts: readonly string[], role: "document" | "query") => Promise<Float32Array[]>;
}

export interface RunEmbeddingJobOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  job: StoredJob;
  /** Loads the model, or returns the one already loaded. */
  loadSession: (model: StoredModel) => Promise<EmbeddingSession>;
}

/**
 * Embeds one snapshot into one space: chunks its text (`chunker@1`), fits each
 * chunk to the model's input limit, embeds the parts in batches and stores a
 * vector per part, checkpointing after every batch so an interrupted job
 * resumes where it stopped. The session takes this space if it has none.
 *
 * Chunks are stored as ranges of the snapshot's text: the text itself stays
 * only in the encrypted snapshot.
 *
 * @returns How many vectors this run stored.
 * @throws When the snapshot or space is gone, or the space's model is not the
 *   active one; the queue then retries with backoff.
 */
export const runEmbeddingJob = async ({
  database,
  job,
  loadSession,
}: RunEmbeddingJobOptions): Promise<number> => {
  const { snapshotId, spaceId } = v.parse(embedSnapshotPayloadSchema, job.payload);
  const [snapshot, space, model] = await Promise.all([
    database.get(SNAPSHOT_STORE, snapshotId),
    database.get(SPACE_STORE, spaceId),
    getActiveModel(database, "embedding"),
  ]);

  if (snapshot === undefined || space === undefined) {
    throw new Error(`Snapshot "${snapshotId}" or space "${spaceId}" no longer exists.`);
  }

  if (
    model?.manifest.contract.family !== "embedding" ||
    model.manifest.reference.repository !== space.model.repository ||
    model.manifest.reference.revision !== space.model.revision
  ) {
    throw new Error(`The model of space "${spaceId}" is not the active embedding model.`);
  }

  const contract = model.manifest.contract;
  const text = (await readSnapshotText(database, snapshotId)) ?? "";
  const chunks: StoredChunk[] = chunkText(text).map(({ index, start, end }) => ({
    id: `${snapshotId}:${index}`,
    snapshotId,
    nodeId: snapshot.nodeId,
    sessionId: snapshot.sessionId,
    chunkerVersion: CHUNKER_VERSION,
    index,
    start,
    end,
  }));
  const chunkTransaction = database.transaction(CHUNK_STORE, "readwrite");

  await Promise.all([
    ...chunks.map((chunk) => chunkTransaction.store.put(chunk)),
    chunkTransaction.done,
  ]);

  const parts = chunks.flatMap((chunk) =>
    splitChunkForModel(text.slice(chunk.start, chunk.end), contract).map((partText, part) => ({
      chunk,
      part,
      text: partText,
    })),
  );
  const resumeAt = v.safeParse(embedSnapshotCheckpointSchema, job.checkpoint);
  let stored = 0;

  if (parts.length > 0) {
    const session = await loadSession(model);

    for (
      let first = resumeAt.success ? resumeAt.output.nextPart : 0;
      first < parts.length;
      first += EMBEDDING_BATCH_SIZE
    ) {
      const batch = parts.slice(first, first + EMBEDDING_BATCH_SIZE);
      const vectors = await session.embed(
        batch.map(({ text: partText }) => partText),
        "document",
      );
      const vectorTransaction = database.transaction(VECTOR_STORE, "readwrite");

      await Promise.all([
        ...batch.map(({ chunk, part }, index) =>
          vectorTransaction.store.put({
            spaceId,
            chunkId: chunk.id,
            part,
            nodeId: chunk.nodeId,
            sessionId: chunk.sessionId,
            vector: vectors[index] ?? new Float32Array(space.dims),
          }),
        ),
        vectorTransaction.done,
      ]);
      stored += batch.length;
      await checkpointJob(database, job.id, { nextPart: first + batch.length });
    }
  }

  await claimSessionEmbeddingSpace(database, snapshot.sessionId, spaceId);

  return stored;
};
