import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { trackActiveDwell } from ".";
import { followTabMembership } from "../followTabMembership";
import type { CaptureTab } from "../../types";
import { recordNavigation } from "../recordNavigation";
import {
  ACTIVITY_STORE,
  EDGE_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredNode,
} from "@/shared/storage";

const GROUP_ID = 42;
const MINUTE = 60_000;

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all([
    database.clear(SESSION_STORE),
    database.clear(NODE_STORE),
    database.clear(EDGE_STORE),
    database.clear(ACTIVITY_STORE),
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
  await followTabMembership({ database, tab: sessionTab(7, "https://example.org/a") });
  await followTabMembership({ database, tab: sessionTab(8, "https://example.org/b") });
});

const sessionTab = (id: number, url: string): CaptureTab => ({
  id,
  url,
  title: url,
  groupId: GROUP_ID,
  incognito: false,
});

/** The node a session tab shows. */
const readNode = async (url: string): Promise<StoredNode> => {
  const node = (await database.getAll(NODE_STORE)).find((candidate) => candidate.url === url);

  if (node === undefined) {
    throw new Error(`No node for ${url}.`);
  }

  return node;
};

const readDwell = async (url: string) => (await readNode(url)).signals.activeDwellMs;
const readRevisits = async (url: string) => (await readNode(url)).signals.revisitCount;
const readVisit = async () => (await database.get(SESSION_STORE, "session-1"))?.focus;

const track = (focusedTabId: number | undefined, now: number, discardOpen = false) =>
  trackActiveDwell({ database, focusedTabId, now, discardOpen });

describe("trackActiveDwell", () => {
  it("adds the time a tab was read when the user switches away from it", async () => {
    await track(7, 1_000);

    expect(await track(8, 31_000)).toEqual({
      dwelledNodeId: (await readNode("https://example.org/a")).id,
    });
    expect(await readDwell("https://example.org/a")).toBe(30_000);
    expect(await readDwell("https://example.org/b")).toBe(0);
  });

  it("counts nothing while the window is unfocused or the user idle", async () => {
    await track(7, 1_000);
    await track(undefined, 11_000);
    await track(undefined, 200_000);

    expect(await readDwell("https://example.org/a")).toBe(10_000);
    expect(await readVisit()).toMatchObject({ since: null, visitDwellMs: 10_000 });
  });

  it("continues the same visit when the user comes back to the same page", async () => {
    await track(7, 1_000);
    await track(undefined, 11_000);
    await track(7, 50_000);
    await track(8, 60_000);

    expect(await readDwell("https://example.org/a")).toBe(20_000);
    expect(await readRevisits("https://example.org/a")).toBe(0);
  });

  it("brings the running interval up to date without ending the visit", async () => {
    await track(7, 1_000);
    await track(7, 3_000);

    expect(await readDwell("https://example.org/a")).toBe(2_000);
    expect(await readVisit()).toMatchObject({ since: 3_000, visitDwellMs: 2_000 });
  });

  it("logs each counted interval on the session's timeline", async () => {
    await track(7, 1_000);
    await track(8, 31_000);
    await track(7, 61_000);

    const [a, b] = await Promise.all([
      readNode("https://example.org/a"),
      readNode("https://example.org/b"),
    ]);
    const activity = (await database.getAll(ACTIVITY_STORE)).sort((x, y) => x.at - y.at);

    expect(activity.map(({ nodeId, kind, at, endAt }) => ({ nodeId, kind, at, endAt }))).toEqual([
      { nodeId: a.id, kind: "focus", at: 1_000, endAt: 31_000 },
      { nodeId: b.id, kind: "focus", at: 31_000, endAt: 61_000 },
    ]);
  });

  it("logs nothing for an interval left open by a previous run", async () => {
    await track(7, 1_000);
    await track(7, 5 * MINUTE, true);

    expect(await database.count(ACTIVITY_STORE)).toBe(0);
  });

  it("caps one uninterrupted stretch at ten minutes", async () => {
    await track(7, 0);
    await track(undefined, 3 * 60 * MINUTE);

    expect(await readDwell("https://example.org/a")).toBe(10 * MINUTE);
  });

  it("counts nothing for a time before the interval began", async () => {
    await track(7, 10_000);
    await track(undefined, 5_000);

    expect(await readDwell("https://example.org/a")).toBe(0);
  });

  it("counts a return to a page read before as a revisit once it lasts 20 s", async () => {
    await track(7, 0);
    await track(8, 10_000);
    await track(7, 20_000);
    await track(7, 35_000);

    expect(await readRevisits("https://example.org/a")).toBe(0);

    await track(7, 40_000);
    await track(8, 90_000);

    expect(await readRevisits("https://example.org/a")).toBe(1);
  });

  it("never counts a first visit as a revisit, however long", async () => {
    await track(7, 0);
    await track(8, 5 * MINUTE);

    expect(await readRevisits("https://example.org/a")).toBe(0);
  });

  it("does not make a return to a page that got no time a revisit", async () => {
    // Passed through on the way to another tab, then read properly.
    await track(7, 0);
    await track(8, 0);
    await track(7, 10_000);
    await track(8, 60_000);

    expect(await readDwell("https://example.org/a")).toBe(50_000);
    expect(await readRevisits("https://example.org/a")).toBe(0);
  });

  it("records nothing for a tab outside the session", async () => {
    await track(99, 1_000);
    await track(7, 31_000);

    expect(await readDwell("https://example.org/a")).toBe(0);
    expect(await readDwell("https://example.org/b")).toBe(0);
  });

  it("drops an interval left open by a previous run", async () => {
    await track(7, 1_000);
    await track(7, 5 * MINUTE, true);

    expect(await readDwell("https://example.org/a")).toBe(0);
    expect(await readVisit()).toMatchObject({ since: 5 * MINUTE });
  });

  it("writes nothing without an active session", async () => {
    await database.clear(SESSION_STORE);

    expect(await track(7, 1_000)).toEqual({ dwelledNodeId: undefined });
    expect(await database.count(SESSION_STORE)).toBe(0);
  });

  it("links two pages the user moves between three times within 5 minutes", async () => {
    await track(7, 0);
    await track(8, 10_000);
    await track(7, 20_000);

    expect(await database.count(EDGE_STORE)).toBe(0);

    await track(8, 30_000);

    expect(await database.getAll(EDGE_STORE)).toEqual([
      expect.objectContaining({ kind: "coAttention" }),
    ]);
  });

  it("does not link pages compared too slowly", async () => {
    await track(7, 0);
    await track(8, 1 * MINUTE);
    await track(7, 4 * MINUTE);
    await track(8, 7 * MINUTE);

    expect(await database.count(EDGE_STORE)).toBe(0);
  });

  it("does not take losing and regaining window focus for a move", async () => {
    await track(7, 0);
    await track(undefined, 1_000);
    await track(7, 2_000);
    await track(undefined, 3_000);
    await track(7, 4_000);
    await track(8, 5_000);

    expect(await database.count(EDGE_STORE)).toBe(0);
    expect((await database.get(SESSION_STORE, "session-1"))?.recentSwitches).toEqual([
      expect.objectContaining({ at: 5_000 }),
    ]);
  });

  it("counts a quick return when the user goes back to the search in the same tab", async () => {
    const api = {
      getTab: () => Promise.resolve({ ...sessionTab(9, "https://duckduckgo.com/?q=motors") }),
      queryGroupTabs: () => Promise.resolve([]),
    };
    const navigate = (url: string) =>
      recordNavigation({
        database,
        api,
        navigation: { tabId: 9, frameId: 0, url, transitionType: "link" },
      });

    await navigate("https://duckduckgo.com/?q=motors");
    await track(9, 0);
    await navigate("https://example.org/result");
    await track(9, 1_000);
    await navigate("https://duckduckgo.com/?q=motors");
    await track(9, 5_000);

    expect((await readNode("https://example.org/result")).signals.quickReturnCount).toBe(1);
  });

  it("forgets where the user left off once they read another page", async () => {
    const left = await readNode("https://example.org/a");

    await database.put(SESSION_STORE, {
      ...(await database.get(SESSION_STORE, "session-1"))!,
      lastPosition: { nodeId: left.id, title: "A", readFraction: 0.4 },
    });
    await track(7, 1_000);

    expect((await database.get(SESSION_STORE, "session-1"))?.lastPosition).toBeDefined();

    await track(8, 2_000);

    expect((await database.get(SESSION_STORE, "session-1"))?.lastPosition).toBeUndefined();
  });
});
