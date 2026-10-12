import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { updateNodeTitle } from ".";
import { recordNode } from "../recordNode";
import { NODE_STORE, openResearchDatabase, type ResearchDatabaseSchema } from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(NODE_STORE);
});

const recordPage = () =>
  recordNode(database, {
    sessionId: "session-1",
    tabId: 7,
    kind: "page",
    url: "https://example.org/motors",
    domain: "example.org",
    title: "Previous page",
    parentNodeId: null,
    openerNodeId: null,
    transitionType: "link",
  });

describe("updateNodeTitle", () => {
  it("takes the title the page reported", async () => {
    const node = await recordPage();

    await updateNodeTitle(database, node.id, "  Mid-drive motors ");

    expect(await database.get(NODE_STORE, node.id)).toMatchObject({ title: "Mid-drive motors" });
  });

  it("keeps the title when the page reports a blank one", async () => {
    const node = await recordPage();

    await updateNodeTitle(database, node.id, "   ");

    expect(await database.get(NODE_STORE, node.id)).toEqual(node);
  });

  it("ignores a node that does not exist", async () => {
    await expect(updateNodeTitle(database, "missing", "Title")).resolves.toBeUndefined();
    expect(await database.count(NODE_STORE)).toBe(0);
  });
});
