import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { countSessionNodes } from ".";
import type { NewNode } from "../../types";
import { closeNode } from "../closeNode";
import { recordNode } from "../recordNode";
import { NODE_STORE, openResearchDatabase, type ResearchDatabaseSchema } from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(NODE_STORE);
});

const page = (sessionId: string): NewNode => ({
  sessionId,
  tabId: 7,
  kind: "page",
  url: "https://example.org",
  domain: "example.org",
  title: "Example",
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
});

describe("countSessionNodes", () => {
  it("is zero for a session with nothing recorded", async () => {
    expect(await countSessionNodes(database, "session-1")).toBe(0);
  });

  it("counts the session's pages, closed ones included, and no other session's", async () => {
    const first = await recordNode(database, page("session-1"));
    await recordNode(database, page("session-1"));
    await recordNode(database, page("session-2"));
    await closeNode(database, first.id);

    expect(await countSessionNodes(database, "session-1")).toBe(2);
  });
});
