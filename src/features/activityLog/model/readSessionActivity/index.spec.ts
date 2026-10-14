import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { readSessionActivity } from ".";
import {
  ACTIVITY_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  type StoredActivity,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const record = (id: string, sessionId: string, at: number): StoredActivity => ({
  id,
  sessionId,
  nodeId: "a",
  kind: "focus",
  at,
  endAt: at + 10,
});

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(ACTIVITY_STORE);
});

describe("readSessionActivity", () => {
  it("reads only the session's records, earliest first", async () => {
    await database.put(ACTIVITY_STORE, record("late", "session-1", 300));
    await database.put(ACTIVITY_STORE, record("other", "session-2", 100));
    await database.put(ACTIVITY_STORE, record("early", "session-1", 200));

    expect((await readSessionActivity(database, "session-1")).map(({ id }) => id)).toEqual([
      "early",
      "late",
    ]);
  });
});
