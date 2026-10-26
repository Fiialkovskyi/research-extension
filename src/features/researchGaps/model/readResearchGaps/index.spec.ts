import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readResearchGaps } from ".";
import {
  NODE_STORE,
  openResearchDatabase,
  PAGE_METADATA_STORE,
  SESSION_STORE,
} from "@/shared/storage";

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all([
    database.clear(NODE_STORE),
    database.clear(SESSION_STORE),
    database.clear(PAGE_METADATA_STORE),
  ]);
  await database.put(SESSION_STORE, {
    id: "s",
    title: "Laptops",
    groupId: 42,
    formerGroupIds: [],
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });
  await database.put(NODE_STORE, {
    id: "shop",
    sessionId: "s",
    kind: "page",
    url: "https://telemart.ua/neo",
  } as never);
  await database.put(NODE_STORE, {
    id: "q",
    sessionId: "s",
    kind: "serp",
    url: "https://www.youtube.com/results?search_query=x",
  } as never);
});

describe("readResearchGaps", () => {
  it("lists the kinds no page declares itself to be, searching the session's title", async () => {
    const database = await openResearchDatabase();

    for (const id of ["shop2", "shop3"]) {
      await database.put(NODE_STORE, {
        id,
        sessionId: "s",
        kind: "page",
        url: `https://example.org/${id}`,
      } as never);
    }

    for (const [nodeId, schemaTypes] of [
      ["shop", ["Product", "Offer"]],
      ["shop2", ["Offer"]],
      ["shop3", ["Review"]],
    ] as const) {
      await database.put(PAGE_METADATA_STORE, {
        nodeId,
        sessionId: "s",
        capturedAt: 1,
        schemaTypes: [...schemaTypes],
      });
    }

    const gaps = await readResearchGaps(database, "s");

    expect(gaps?.cellGaps).toEqual([]);
    expect(gaps?.categoryGaps.map(({ query }) => query)).toEqual([
      "Laptops forum",
      "Laptops video review",
    ]);
  });

  it("reports no kind when the pages declare nothing, whatever their hosts", async () => {
    const gaps = await readResearchGaps(await openResearchDatabase(), "s");

    expect(gaps?.categoryGaps).toEqual([]);
  });

  it("reads nothing without a live session", async () => {
    const database = await openResearchDatabase();

    await database.clear(SESSION_STORE);

    expect(await readResearchGaps(database, "s")).toBeUndefined();
  });
});
