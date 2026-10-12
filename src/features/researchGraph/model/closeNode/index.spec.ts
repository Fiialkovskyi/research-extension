import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { closeNode } from ".";
import { addNodeSignals } from "../addNodeSignals";
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

describe("closeNode", () => {
  it("marks the tab closed and keeps what was observed", async () => {
    const node = await recordNode(database, page());
    await addNodeSignals(database, node.id, { activeDwellMs: 12_000 });

    await closeNode(database, node.id);

    expect(await database.get(NODE_STORE, node.id)).toMatchObject({
      tabState: "closed",
      signals: { activeDwellMs: 12_000 },
    });
  });

  it("ignores a node that does not exist", async () => {
    await expect(closeNode(database, "missing")).resolves.toBeUndefined();
    expect(await database.count(NODE_STORE)).toBe(0);
  });
});
