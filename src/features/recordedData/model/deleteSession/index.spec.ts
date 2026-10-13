import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { deleteSession } from ".";
import {
  CHUNK_STORE,
  CLUSTERING_STORE,
  EDGE_STORE,
  ENTITY_STORE,
  EXTRACTION_STORE,
  FACT_STORE,
  JOB_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  SNAPSHOT_STORE,
  SPACE_STORE,
  VECTOR_STORE,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const STORES = [
  NODE_STORE,
  EDGE_STORE,
  SNAPSHOT_STORE,
  CHUNK_STORE,
  VECTOR_STORE,
  FACT_STORE,
  EXTRACTION_STORE,
  ENTITY_STORE,
  JOB_STORE,
  CLUSTERING_STORE,
  SESSION_STORE,
  SPACE_STORE,
] as const;

/** One record of every session-scoped kind for `sessionId`. */
const record = async (sessionId: string) => {
  await database.put(SESSION_STORE, {
    id: sessionId,
    title: sessionId,
    groupId: 42,
    formerGroupIds: [],
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });
  await database.put(NODE_STORE, { id: `${sessionId}-n`, sessionId } as never);
  await database.put(EDGE_STORE, { id: `${sessionId}-e`, sessionId } as never);
  await database.put(SNAPSHOT_STORE, { id: `${sessionId}-s`, sessionId } as never);
  await database.put(CHUNK_STORE, {
    id: `${sessionId}-c`,
    snapshotId: `${sessionId}-s`,
    sessionId,
  } as never);
  await database.put(VECTOR_STORE, {
    spaceId: "space-1",
    chunkId: `${sessionId}-c`,
    part: 0,
    nodeId: `${sessionId}-n`,
    sessionId,
  } as never);
  await database.put(FACT_STORE, {
    id: `${sessionId}-s:0:0`,
    sessionId,
    nodeId: `${sessionId}-n`,
  } as never);
  await database.put(EXTRACTION_STORE, {
    snapshotId: `${sessionId}-s`,
    sessionId,
    nodeId: `${sessionId}-n`,
  } as never);
  await database.put(ENTITY_STORE, { id: `${sessionId}-entity`, sessionId } as never);
  await database.put(JOB_STORE, {
    id: `${sessionId}-j`,
    sessionId,
    status: "done",
    priority: 0,
  } as never);
  await database.put(CLUSTERING_STORE, { sessionId, clusters: [] } as never);
};

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all(STORES.map((store) => database.clear(store)));
  await record("session-1");
  await record("session-2");
  await database.put(SPACE_STORE, { id: "space-1" } as never);
});

describe("deleteSession", () => {
  it("deletes every record of the session, and the session", async () => {
    expect(await deleteSession(database, "session-1")).toBe(true);

    for (const store of STORES.filter((name) => name !== SPACE_STORE)) {
      const records = (await database.getAll(store)) as { sessionId?: string; id?: string }[];

      expect(
        records.some((item) => item.sessionId === "session-1" || item.id === "session-1"),
        store,
      ).toBe(false);
    }
  });

  it("leaves another session's records and the shared spaces alone", async () => {
    await deleteSession(database, "session-1");

    expect(await database.get(SESSION_STORE, "session-2")).toBeDefined();
    expect(await database.count(NODE_STORE)).toBe(1);
    expect(await database.count(VECTOR_STORE)).toBe(1);
    expect(await database.count(FACT_STORE)).toBe(1);
    expect(await database.count(ENTITY_STORE)).toBe(1);
    expect(await database.count(SPACE_STORE)).toBe(1);
  });

  it("reports a session that does not exist, deleting nothing", async () => {
    expect(await deleteSession(database, "missing")).toBe(false);
    expect(await database.count(NODE_STORE)).toBe(2);
  });
});
