import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { readSnapshotCandidate } from ".";
import {
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  type StoredNode,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const buildNode = (overrides: Partial<StoredNode> = {}): StoredNode => ({
  id: "a",
  sessionId: "session-1",
  tabId: 7,
  kind: "page",
  url: "https://example.org/a",
  domain: "example.org",
  title: "A",
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  signals: { activeDwellMs: 0, maxScroll: 0, copyEvents: 1, focusCount: 1, revisitCount: 0 },
  tabState: "open",
  createdAt: 1,
  ...overrides,
});

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(NODE_STORE);
});

describe("readSnapshotCandidate", () => {
  it("returns an open, deep-read node that has no snapshot", async () => {
    await database.put(NODE_STORE, buildNode());

    expect(await readSnapshotCandidate(database, "a")).toMatchObject({ id: "a" });
  });

  it("skips a node that already has a snapshot", async () => {
    await database.put(NODE_STORE, buildNode({ snapshotId: "snapshot-1" }));

    expect(await readSnapshotCandidate(database, "a")).toBeUndefined();
  });

  it("skips a node whose page has gone", async () => {
    await database.put(NODE_STORE, buildNode({ tabState: "closed" }));

    expect(await readSnapshotCandidate(database, "a")).toBeUndefined();
  });

  it("skips a node that is not deep read", async () => {
    await database.put(
      NODE_STORE,
      buildNode({
        signals: {
          activeDwellMs: 9_000,
          maxScroll: 0.2,
          copyEvents: 0,
          focusCount: 1,
          revisitCount: 0,
        },
      }),
    );

    expect(await readSnapshotCandidate(database, "a")).toBeUndefined();
  });

  it("skips a node that does not exist", async () => {
    expect(await readSnapshotCandidate(database, "missing")).toBeUndefined();
  });
});
