import type { IDBPDatabase } from "idb";

import { enqueueJob } from "@/features/jobQueue";
import { getActiveModel } from "@/features/modelRegistry";
import { EXTRACTOR_VERSION } from "@/features/pageSnapshots";
import { readSessionGraph } from "@/features/researchGraph";
import {
  type ResearchDatabaseSchema,
  SNAPSHOT_STORE,
  SPACE_STORE,
  type StoredJob,
  SESSION_STORE,
} from "@/shared/storage";

import { EMBED_SNAPSHOT_JOB } from "../../constants";
import type { EmbedSnapshotPayload } from "../../types";
import { buildEmbeddingSpace } from "../buildEmbeddingSpace";

/**
 * Queues an embedding job for every snapshot of the active session, into the
 * active embedding model's space, and stores that space.
 *
 * Idempotent: a job is identified by the snapshot, its content and the space,
 * and the queue skips one that is queued, running or done — so this can run
 * whenever there may be something new, and a snapshot is embedded once.
 *
 * @returns The jobs as the queue now holds them; none without an active
 *   session or an active embedding model.
 */
export const enqueueSnapshotEmbeddings = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  now: number = Date.now(),
): Promise<StoredJob[]> => {
  const [session, model] = await Promise.all([
    database.get(SESSION_STORE, sessionId),
    getActiveModel(database, "embedding"),
  ]);

  if (session?.status !== "active" || model?.manifest.contract.family !== "embedding") {
    return [];
  }

  const space = await buildEmbeddingSpace({
    reference: model.manifest.reference,
    contract: model.manifest.contract,
    extractorVersion: EXTRACTOR_VERSION,
    ...(model.manifest.quantization === undefined
      ? {}
      : { quantization: model.manifest.quantization }),
    now,
  });

  if ((await database.get(SPACE_STORE, space.id)) === undefined) {
    await database.put(SPACE_STORE, space);
  }

  const { nodes } = await readSessionGraph(database, session.id);
  const jobs: StoredJob[] = [];

  for (const node of nodes) {
    const snapshot =
      node.snapshotId === undefined
        ? undefined
        : await database.get(SNAPSHOT_STORE, node.snapshotId);

    if (snapshot !== undefined) {
      const payload: EmbedSnapshotPayload = { snapshotId: snapshot.id, spaceId: space.id };

      jobs.push(
        await enqueueJob(database, {
          type: EMBED_SNAPSHOT_JOB,
          sessionId: session.id,
          inputHashes: [snapshot.id, snapshot.contentHash],
          producerVersion: space.id,
          payload,
        }),
      );
    }
  }

  return jobs;
};
