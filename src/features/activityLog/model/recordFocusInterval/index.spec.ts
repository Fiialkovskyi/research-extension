import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { recordFocusInterval } from ".";
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

const interval = (nodeId: string, startedAt: number, endedAt: number) => ({
  sessionId: "session-1",
  nodeId,
  startedAt,
  endedAt,
});

describe("recordFocusInterval", () => {
  it("logs an interval as a focus record of its page", async () => {
    const recorded = await recordFocusInterval(database, interval("a", 1000, 5000));

    expect(recorded).toMatchObject({
      sessionId: "session-1",
      nodeId: "a",
      kind: "focus",
      at: 1000,
      endAt: 5000,
    });
    expect(await database.get(ACTIVITY_STORE, recorded.id)).toEqual(recorded);
  });

  it("extends the page's latest interval when the next one continues it", async () => {
    const first = await recordFocusInterval(database, interval("a", 1000, 5000));
    const second = await recordFocusInterval(database, interval("a", 5800, 9000));

    expect(second).toEqual({ ...first, endAt: 9000 });
    expect(await database.count(ACTIVITY_STORE)).toBe(1);
  });

  it("starts a new interval after a gap longer than a second", async () => {
    await recordFocusInterval(database, interval("a", 1000, 5000));
    await recordFocusInterval(database, interval("a", 6001, 9000));

    expect(await database.count(ACTIVITY_STORE)).toBe(2);
  });

  it("never extends another page's interval", async () => {
    await recordFocusInterval(database, interval("a", 1000, 5000));
    await recordFocusInterval(database, interval("b", 5000, 9000));

    expect(await database.count(ACTIVITY_STORE)).toBe(2);
  });

  it("ignores the page's copies when finding its latest interval", async () => {
    await recordFocusInterval(database, interval("a", 1000, 5000));
    await database.put(ACTIVITY_STORE, {
      id: "copy",
      sessionId: "session-1",
      nodeId: "a",
      kind: "copy",
      at: 5200,
      endAt: 5200,
    });

    const extended = await recordFocusInterval(database, interval("a", 5500, 7000));

    expect(extended).toMatchObject({ kind: "focus", at: 1000, endAt: 7000 });
  });
});
