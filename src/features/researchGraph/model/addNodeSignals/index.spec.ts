import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { addNodeSignals } from ".";
import { recordNode } from "../recordNode";
import type { NewNode } from "../../types";
import {
  EDGE_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(NODE_STORE);
  await database.clear(EDGE_STORE);
});

/** A page as capture would first report it. */
const page = (overrides: Partial<NewNode> = {}): NewNode => ({
  sessionId: "session-1",
  tabId: 7,
  kind: "page",
  url: "https://example.org/motors",
  domain: "example.org",
  title: "Motors",
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  ...overrides,
});

describe("addNodeSignals", () => {
  it("adds dwell across observations", async () => {
    const node = await recordNode(database, page());

    await addNodeSignals(database, node.id, { activeDwellMs: 10_000 });
    const merged = await addNodeSignals(database, node.id, { activeDwellMs: 5000 });

    expect(merged.signals.activeDwellMs).toBe(15_000);
    expect(await database.get(NODE_STORE, node.id)).toEqual(merged);
  });

  it("keeps both of two observations arriving together", async () => {
    const node = await recordNode(database, page());

    await Promise.all([
      addNodeSignals(database, node.id, { copyEvents: 1 }),
      addNodeSignals(database, node.id, { copyEvents: 1 }),
    ]);

    expect((await database.get(NODE_STORE, node.id))?.signals.copyEvents).toBe(2);
  });

  it("names the node when it was never recorded", async () => {
    await expect(addNodeSignals(database, "missing", { focusCount: 1 })).rejects.toThrow(
      'No node is recorded under "missing".',
    );
  });
});
