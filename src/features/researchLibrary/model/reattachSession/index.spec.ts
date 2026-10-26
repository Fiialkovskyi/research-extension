import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { reattachSession } from ".";
import { declineReattach } from "../declineReattach";
import {
  CHUNK_STORE,
  CLUSTERING_STORE,
  EDGE_STORE,
  JOB_STORE,
  NODE_STORE,
  openResearchDatabase,
  PAGE_METADATA_STORE,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  SNAPSHOT_STORE,
  type StoredSession,
  VECTOR_STORE,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const STORES = [
  NODE_STORE,
  EDGE_STORE,
  SNAPSHOT_STORE,
  CHUNK_STORE,
  VECTOR_STORE,
  JOB_STORE,
  CLUSTERING_STORE,
  SESSION_STORE,
  PAGE_METADATA_STORE,
] as const;

const NEW: StoredSession = {
  id: "new",
  title: "Mid-drive",
  groupId: 9,
  formerGroupIds: [],
  status: "active",
  reattachSuggestion: { sessionId: "old", title: "E-bike motors" },
  createdAt: 2,
  updatedAt: 2,
};

const OLD: StoredSession = {
  id: "old",
  title: "E-bike motors",
  groupId: 4,
  formerGroupIds: [],
  status: "saved",
  lastPosition: { nodeId: "old-root", title: "Old", readFraction: 0.4 },
  savedTabs: [],
  createdAt: 1,
  updatedAt: 1,
};

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all(STORES.map((store) => database.clear(store)));
  await database.put(SESSION_STORE, NEW);
  await database.put(SESSION_STORE, OLD);
  await database.put(NODE_STORE, { id: "old-root", sessionId: "old" } as never);
  await database.put(NODE_STORE, { id: "new-root", sessionId: "new" } as never);
  await database.put(EDGE_STORE, { id: "e", sessionId: "new" } as never);
  await database.put(SNAPSHOT_STORE, { id: "s", sessionId: "new" } as never);
  await database.put(CHUNK_STORE, { id: "c", snapshotId: "s", sessionId: "new" } as never);
  await database.put(VECTOR_STORE, {
    spaceId: "x",
    chunkId: "c",
    part: 0,
    nodeId: "new-root",
    sessionId: "new",
  } as never);
  await database.put(JOB_STORE, {
    id: "j",
    sessionId: "new",
    status: "done",
    priority: 0,
  } as never);
  await database.put(PAGE_METADATA_STORE, { nodeId: "new-root", sessionId: "new" } as never);
  await database.put(CLUSTERING_STORE, { sessionId: "new", clusters: [] } as never);
});

describe("reattachSession", () => {
  it("moves every record of the new session to the saved one", async () => {
    await reattachSession({ database, activeSessionId: "new", savedSessionId: "old", now: 5 });

    for (const store of [
      NODE_STORE,
      EDGE_STORE,
      SNAPSHOT_STORE,
      CHUNK_STORE,
      VECTOR_STORE,
      JOB_STORE,
      PAGE_METADATA_STORE,
    ] as const) {
      const records = (await database.getAll(store)) as { sessionId: string }[];

      expect(
        records.every(({ sessionId }) => sessionId === "old"),
        store,
      ).toBe(true);
    }

    expect(await database.count(NODE_STORE)).toBe(2);
  });

  it("makes the saved session active on the current group, and removes the new one", async () => {
    const continued = await reattachSession({
      database,
      activeSessionId: "new",
      savedSessionId: "old",
      now: 5,
    });

    expect(continued).toMatchObject({
      id: "old",
      title: "E-bike motors",
      status: "active",
      groupId: 9,
      formerGroupIds: [4],
      updatedAt: 5,
    });
    expect(continued).not.toHaveProperty("lastPosition");
    expect(continued).not.toHaveProperty("savedTabs");
    expect(await database.get(SESSION_STORE, "new")).toBeUndefined();
    expect(await database.get(CLUSTERING_STORE, "new")).toBeUndefined();
  });

  it("continues a closed session, whose group is gone, like a saved one", async () => {
    await database.put(SESSION_STORE, { ...OLD, status: "closed" });

    expect(
      await reattachSession({ database, activeSessionId: "new", savedSessionId: "old", now: 5 }),
    ).toMatchObject({ id: "old", status: "active" });
  });

  it("changes nothing when the sessions are not active and saved", async () => {
    await database.put(SESSION_STORE, { ...OLD, status: "done" as never });

    await expect(
      reattachSession({ database, activeSessionId: "new", savedSessionId: "old", now: 5 }),
    ).rejects.toThrow("Only a saved session");
    expect(await database.get(SESSION_STORE, "new")).toMatchObject({ status: "active" });
    expect((await database.get(NODE_STORE, "new-root"))?.sessionId).toBe("new");
  });
});

describe("declineReattach", () => {
  it("withdraws the offer for good", async () => {
    expect(await declineReattach(database, "new")).toBe(true);

    const session = await database.get(SESSION_STORE, "new");

    expect(session).not.toHaveProperty("reattachSuggestion");
    expect(session?.reattachDeclined).toBe(true);
  });

  it("reports a session that does not exist", async () => {
    expect(await declineReattach(database, "missing")).toBe(false);
  });
});
