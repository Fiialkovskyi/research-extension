import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { recordPageMarks } from ".";
import {
  ACTIVITY_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(ACTIVITY_STORE);
});

describe("recordPageMarks", () => {
  it("logs every copy and paste of a batch at the time it was received", async () => {
    const records = await recordPageMarks(database, {
      sessionId: "session-1",
      nodeId: "a",
      copyEvents: 2,
      pasteEvents: 1,
      at: 4000,
    });

    expect(records.map(({ kind }) => kind)).toEqual(["copy", "copy", "paste"]);
    expect(records.every(({ at, endAt }) => at === 4000 && endAt === 4000)).toBe(true);
    expect(await database.count(ACTIVITY_STORE)).toBe(3);
  });

  it("writes nothing for a batch with neither", async () => {
    const records = await recordPageMarks(database, {
      sessionId: "session-1",
      nodeId: "a",
      copyEvents: 0,
      pasteEvents: 0,
      at: 4000,
    });

    expect(records).toEqual([]);
    expect(await database.count(ACTIVITY_STORE)).toBe(0);
  });
});
