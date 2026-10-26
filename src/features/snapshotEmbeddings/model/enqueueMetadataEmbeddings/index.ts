import type { IDBPDatabase } from "idb";

import { enqueueJob } from "@/features/jobQueue";
import { getActiveModel } from "@/features/modelRegistry";
import { EXTRACTOR_VERSION } from "@/features/pageSnapshots";
import { readSessionGraph } from "@/features/researchGraph";
import {
  PAGE_METADATA_STORE,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  SPACE_STORE,
  type StoredJob,
} from "@/shared/storage";

import { EMBED_METADATA_JOB } from "../../constants";
import { buildEmbeddingSpace } from "../buildEmbeddingSpace";

/**
 * Queues an embedding job for the metadata of every page of the active session
 * that has metadata and no snapshot yet, into the active embedding model's
 * space, and stores that space.
 *
 * Idempotent, like `enqueueSnapshotEmbeddings`: a job is identified by the
 * node, the moment its metadata was read and the space, so a page is embedded
 * once and again only if its metadata was read again.
 *
 * @returns The jobs as the queue now holds them; none without an active
 *   session or an active embedding model.
 */
export const enqueueMetadataEmbeddings = async (
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
    const metadata =
      node.snapshotId === undefined ? await database.get(PAGE_METADATA_STORE, node.id) : undefined;

    if (metadata !== undefined) {
      jobs.push(
        await enqueueJob(database, {
          type: EMBED_METADATA_JOB,
          sessionId: session.id,
          inputHashes: [node.id, String(metadata.capturedAt)],
          producerVersion: space.id,
          payload: { nodeId: node.id, spaceId: space.id },
        }),
      );
    }
  }

  return jobs;
};
