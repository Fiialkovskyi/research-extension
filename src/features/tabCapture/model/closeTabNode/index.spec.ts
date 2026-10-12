import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { closeTabNode } from ".";
import { followTabMembership } from "../followTabMembership";
import type { CaptureTab } from "../../types";
import {
  EDGE_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
} from "@/shared/storage";

const GROUP_ID = 42;

let database: IDBPDatabase<ResearchDatabaseSchema>;

/** An empty database with one active session following group 42. */
beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all([
    database.clear(SESSION_STORE),
    database.clear(NODE_STORE),
    database.clear(EDGE_STORE),
  ]);
  await database.put(SESSION_STORE, {
    id: "session-1",
    title: "E-bike motors",
    groupId: GROUP_ID,
    formerGroupIds: [],
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });
});

/** A non-private tab of the session group, showing `url`. */
const sessionTab = (overrides: Partial<CaptureTab> = {}): CaptureTab => ({
  id: 7,
  url: "https://example.org/a",
  title: "A",
  groupId: GROUP_ID,
  incognito: false,
  ...overrides,
});

const readNodes = () => database.getAll(NODE_STORE);

describe("closeTabNode", () => {
  it("closes the node of a closed session tab, keeping it", async () => {
    await followTabMembership({ database, tab: sessionTab() });

    await closeTabNode(database, 7);

    expect(await readNodes()).toEqual([expect.objectContaining({ tabState: "closed" })]);
  });

  it("ignores a tab with no node", async () => {
    await followTabMembership({ database, tab: sessionTab() });

    await closeTabNode(database, 99);

    expect(await readNodes()).toEqual([expect.objectContaining({ tabState: "open" })]);
  });
});
