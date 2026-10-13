import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readResearchGaps } from ".";
import { NODE_STORE, openResearchDatabase, SESSION_STORE } from "@/shared/storage";

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all([database.clear(NODE_STORE), database.clear(SESSION_STORE)]);
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
  it("lists the categories no page is, searching the session's title without entities", async () => {
    const gaps = await readResearchGaps(await openResearchDatabase());

    expect(gaps?.cellGaps).toEqual([]);
    expect(gaps?.categoryGaps.map(({ query }) => query)).toEqual([
      "Laptops review",
      "Laptops forum",
      "Laptops video review",
      "Laptops specifications",
    ]);
  });

  it("reads nothing without a live session", async () => {
    const database = await openResearchDatabase();

    await database.clear(SESSION_STORE);

    expect(await readResearchGaps(database)).toBeUndefined();
  });
});
