import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { openGapSearch } from ".";
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
});

const api = () => ({
  createTab: vi.fn((_properties: { url: string; active: boolean }) => Promise.resolve({ id: 9 })),
  groupTabs: vi.fn((_options: { tabIds: [number, ...number[]]; groupId: number }) =>
    Promise.resolve(42),
  ),
});

describe("openGapSearch", () => {
  it("opens the results page in a new tab of the session's group", async () => {
    const browser = api();
    const url = await openGapSearch(await openResearchDatabase(), browser, "MacBook Neo 13 price");

    expect(url).toBe("https://duckduckgo.com/?q=MacBook%20Neo%2013%20price");
    expect(browser.createTab).toHaveBeenCalledWith({ url, active: true });
    expect(browser.groupTabs).toHaveBeenCalledWith({ tabIds: [9], groupId: 42 });
  });

  it("uses the engine the session searched with", async () => {
    const database = await openResearchDatabase();

    await database.put(NODE_STORE, {
      id: "q",
      sessionId: "s",
      kind: "serp",
      url: "https://www.google.com/search?q=laptops",
    } as never);

    expect(await openGapSearch(database, api(), "x")).toBe("https://www.google.com/search?q=x");
  });

  it("refuses without an active session", async () => {
    const database = await openResearchDatabase();

    await database.clear(SESSION_STORE);

    await expect(openGapSearch(database, api(), "x")).rejects.toThrow("session");
  });
});
