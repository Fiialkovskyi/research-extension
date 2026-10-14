import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { recordSignalBatch } from ".";
import {
  ACTIVITY_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredNode,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const NODE: StoredNode = {
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
  signals: {
    activeDwellMs: 0,
    maxScroll: 0,
    copyEvents: 0,
    pasteEvents: 0,
    focusCount: 1,
    revisitCount: 0,
    quickReturnCount: 0,
  },
  tabState: "open",
  createdAt: 1,
};

const SENDER = { tabId: 7, url: "https://example.org/a" };

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all([
    database.clear(SESSION_STORE),
    database.clear(NODE_STORE),
    database.clear(ACTIVITY_STORE),
  ]);
  await database.put(SESSION_STORE, {
    id: "session-1",
    title: "E-bike motors",
    groupId: 42,
    formerGroupIds: [],
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });
  await database.put(NODE_STORE, NODE);
});

const readSignals = async () => (await database.get(NODE_STORE, "a"))?.signals;

describe("recordSignalBatch", () => {
  it("keeps the deepest scroll, even when a later batch reports less", async () => {
    await recordSignalBatch(database, SENDER, { maxScroll: 0.8, copyEvents: 0, pasteEvents: 0 }, 1000);
    await recordSignalBatch(database, SENDER, { maxScroll: 0.3, copyEvents: 0, pasteEvents: 0 }, 1000);

    expect(await readSignals()).toMatchObject({ maxScroll: 0.8 });
  });

  it("adds up copies across batches", async () => {
    await recordSignalBatch(database, SENDER, { maxScroll: 0.1, copyEvents: 1, pasteEvents: 0 }, 1000);
    await recordSignalBatch(database, SENDER, { maxScroll: 0.1, copyEvents: 2, pasteEvents: 0 }, 1000);

    expect(await readSignals()).toMatchObject({ copyEvents: 3 });
  });

  it("answers with the updated node", async () => {
    expect(await recordSignalBatch(database, SENDER, { maxScroll: 0.5, copyEvents: 1, pasteEvents: 0 }, 1000)).toEqual({
      node: expect.objectContaining({
        id: "a",
        signals: expect.objectContaining({ maxScroll: 0.5, copyEvents: 1 }),
      }),
      isCurrent: true,
    });
  });

  it("records nothing for a tab outside the session, and says to stop", async () => {
    expect(
      await recordSignalBatch(
        database,
        { tabId: 99, url: NODE.url },
        { maxScroll: 1, copyEvents: 4, pasteEvents: 0 },
        1000,
      ),
    ).toEqual({ node: undefined, stop: true });
    expect(await readSignals()).toEqual(NODE.signals);
    expect(await database.count(ACTIVITY_STORE)).toBe(0);
  });

  it("adds up pastes, and logs each copy and paste when the batch arrived", async () => {
    await recordSignalBatch(database, SENDER, { maxScroll: 0.1, copyEvents: 1, pasteEvents: 2 }, 5000);

    expect(await readSignals()).toMatchObject({ copyEvents: 1, pasteEvents: 2 });
    expect(
      (await database.getAll(ACTIVITY_STORE)).map(({ nodeId, kind, at }) => ({ nodeId, kind, at })).sort(
        (x, y) => x.kind.localeCompare(y.kind),
      ),
    ).toEqual([
      { nodeId: "a", kind: "copy", at: 5000 },
      { nodeId: "a", kind: "paste", at: 5000 },
      { nodeId: "a", kind: "paste", at: 5000 },
    ]);
  });
});
