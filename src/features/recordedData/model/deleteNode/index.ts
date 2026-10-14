import type { IDBPDatabase } from "idb";

import {
  ACTIVITY_STORE,
  CHUNK_STORE,
  EDGE_STORE,
  ENTITY_STORE,
  EXTRACTION_STORE,
  FACT_STORE,
  JOB_STORE,
  NODE_STORE,
  type ResearchDatabaseSchema,
  SNAPSHOT_STORE,
  VECTOR_STORE,
} from "@/shared/storage";

/** Whether a job works on this snapshot, by the payload embedding and extraction jobs carry. */
const isJobFor = (payload: unknown, snapshotId: string): boolean =>
  typeof payload === "object" &&
  payload !== null &&
  "snapshotId" in payload &&
  payload.snapshotId === snapshotId;

/**
 * Deletes a page and everything derived from it, in one transaction
 * (REQ-STO-008): the node, every edge touching it, its activity, its snapshot, its chunks,
 * its vectors in every space, its facts and their extraction record, the
 * entities left with no facts, and the jobs working on it. Pages reached from
 * it keep their own records.
 *
 * @returns Whether the page existed.
 */
export const deleteNode = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  nodeId: string,
): Promise<boolean> => {
  const transaction = database.transaction(
    [
      NODE_STORE,
      EDGE_STORE,
      SNAPSHOT_STORE,
      CHUNK_STORE,
      VECTOR_STORE,
      FACT_STORE,
      EXTRACTION_STORE,
      ENTITY_STORE,
      JOB_STORE,
      ACTIVITY_STORE,
    ],
    "readwrite",
  );
  const nodes = transaction.objectStore(NODE_STORE);
  const node = await nodes.get(nodeId);

  if (node === undefined) {
    await transaction.done;
    return false;
  }

  const edges = transaction.objectStore(EDGE_STORE);
  const vectors = transaction.objectStore(VECTOR_STORE);
  const facts = transaction.objectStore(FACT_STORE);
  const extractions = transaction.objectStore(EXTRACTION_STORE);
  const activity = transaction.objectStore(ACTIVITY_STORE);
  const [sessionEdges, vectorKeys, pageFacts, extractionKeys, activityKeys] = await Promise.all([
    edges.index("sessionId").getAll(node.sessionId),
    vectors.index("nodeId").getAllKeys(nodeId),
    facts.index("nodeId").getAll(nodeId),
    extractions.index("nodeId").getAllKeys(nodeId),
    activity.index("nodeId").getAllKeys(nodeId),
  ]);
  const deletions: Promise<unknown>[] = [
    nodes.delete(nodeId),
    ...sessionEdges
      .filter((edge) => edge.from === nodeId || edge.to === nodeId)
      .map((edge) => edges.delete(edge.id)),
    ...vectorKeys.map((key) => vectors.delete(key)),
    ...pageFacts.map(({ id }) => facts.delete(id)),
    ...extractionKeys.map((key) => extractions.delete(key)),
    ...activityKeys.map((key) => activity.delete(key)),
  ];

  if (node.snapshotId !== undefined) {
    const { snapshotId } = node;
    const chunks = transaction.objectStore(CHUNK_STORE);
    const jobs = transaction.objectStore(JOB_STORE);
    const [chunkKeys, sessionJobs] = await Promise.all([
      chunks.index("snapshotId").getAllKeys(snapshotId),
      jobs.index("sessionId").getAll(node.sessionId),
    ]);

    deletions.push(
      transaction.objectStore(SNAPSHOT_STORE).delete(snapshotId),
      ...chunkKeys.map((key) => chunks.delete(key)),
      ...sessionJobs
        .filter((job) => isJobFor(job.payload, snapshotId))
        .map((job) => jobs.delete(job.id)),
    );
  }

  await Promise.all(deletions);

  // Entities the page's facts belonged to and no other page's do are gone
  // too; one merged into a removed entity stands on its own again.
  const entities = transaction.objectStore(ENTITY_STORE);
  const touched = [...new Set(pageFacts.flatMap(({ entityId }) => entityId ?? []))];
  const emptied = new Set(
    (
      await Promise.all(
        touched.map(async (entityId) =>
          (await facts.index("entityId").count(entityId)) === 0 ? entityId : undefined,
        ),
      )
    ).flatMap((entityId) => entityId ?? []),
  );
  const orphans = (await entities.index("sessionId").getAll(node.sessionId)).filter(
    ({ id, mergedInto }) => !emptied.has(id) && mergedInto !== undefined && emptied.has(mergedInto),
  );

  await Promise.all([
    ...[...emptied].map((entityId) => entities.delete(entityId)),
    ...orphans.map(({ mergedInto: _removed, ...entity }) => entities.put(entity)),
    transaction.done,
  ]);

  return true;
};
