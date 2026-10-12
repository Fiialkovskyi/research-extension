import type { IDBPDatabase } from "idb";

import {
  CHUNK_STORE,
  EDGE_STORE,
  JOB_STORE,
  NODE_STORE,
  type ResearchDatabaseSchema,
  SNAPSHOT_STORE,
  VECTOR_STORE,
} from "@/shared/storage";

/** Whether a job works on this snapshot, by the payload an embedding job carries. */
const isJobFor = (payload: unknown, snapshotId: string): boolean =>
  typeof payload === "object" &&
  payload !== null &&
  "snapshotId" in payload &&
  payload.snapshotId === snapshotId;

/**
 * Deletes a page and everything derived from it, in one transaction
 * (REQ-STO-008): the node, every edge touching it, its snapshot, its chunks,
 * its vectors in every space and the jobs working on it. Pages reached from
 * it keep their own records.
 *
 * @returns Whether the page existed.
 */
export const deleteNode = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  nodeId: string,
): Promise<boolean> => {
  const transaction = database.transaction(
    [NODE_STORE, EDGE_STORE, SNAPSHOT_STORE, CHUNK_STORE, VECTOR_STORE, JOB_STORE],
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
  const [sessionEdges, vectorKeys] = await Promise.all([
    edges.index("sessionId").getAll(node.sessionId),
    vectors.index("nodeId").getAllKeys(nodeId),
  ]);
  const deletions: Promise<unknown>[] = [
    nodes.delete(nodeId),
    ...sessionEdges
      .filter((edge) => edge.from === nodeId || edge.to === nodeId)
      .map((edge) => edges.delete(edge.id)),
    ...vectorKeys.map((key) => vectors.delete(key)),
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

  await Promise.all([...deletions, transaction.done]);

  return true;
};
