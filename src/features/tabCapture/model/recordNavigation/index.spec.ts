import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recordNavigation } from ".";
import type { CaptureTab, CommittedNavigation, TabCaptureApi } from "../../types";
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

/** An API reporting the given tabs by id. */
const createApi = (...tabs: CaptureTab[]): TabCaptureApi => ({
  getTab: vi.fn(async (tabId: number) => {
    const tab = tabs.find((candidate) => candidate.id === tabId);

    if (tab === undefined) {
      throw new Error(`Invalid tab ID: ${tabId}`);
    }

    return tab;
  }),
  queryGroupTabs: vi.fn(async () => tabs),
});

const commit = (overrides: Partial<CommittedNavigation> = {}): CommittedNavigation => ({
  tabId: 7,
  frameId: 0,
  url: "https://example.org/a",
  transitionType: "link",
  ...overrides,
});

describe("recordNavigation", () => {
  it("records a page committed in a session tab", async () => {
    const node = await recordNavigation({
      database,
      api: createApi(sessionTab()),
      navigation: commit({ transitionType: "typed" }),
    });

    expect(node).toMatchObject({
      sessionId: "session-1",
      tabId: 7,
      url: "https://example.org/a",
      domain: "example.org",
      title: "A",
      transitionType: "typed",
      parentNodeId: null,
      openerNodeId: null,
      tabState: "open",
    });
    expect(await readNodes()).toHaveLength(1);
  });

  it("follows the tab's previous page, closing it and linking the two", async () => {
    const api = createApi(sessionTab({ url: "https://example.org/b", title: "B" }));
    const first = await recordNavigation({ database, api, navigation: commit() });

    const second = await recordNavigation({
      database,
      api,
      navigation: commit({ url: "https://example.org/b" }),
    });

    expect(second).toMatchObject({ parentNodeId: first?.id, title: "B" });
    expect(await database.get(NODE_STORE, first?.id ?? "")).toMatchObject({ tabState: "closed" });
    expect(await database.getAll(EDGE_STORE)).toEqual([
      expect.objectContaining({ kind: "sameTab", from: first?.id, to: second?.id, weight: 0.5 }),
    ]);
  });

  it("links a tab's first page to the page of the tab that opened it", async () => {
    const opener = sessionTab({ id: 3 });
    const opened = sessionTab({ id: 7, url: "https://example.org/b", openerTabId: 3 });
    const api = createApi(opener, opened);
    const source = await recordNavigation({ database, api, navigation: commit({ tabId: 3 }) });

    const node = await recordNavigation({
      database,
      api,
      navigation: commit({ url: "https://example.org/b" }),
    });

    expect(node).toMatchObject({ openerNodeId: source?.id, parentNodeId: null });
    expect(await database.getAll(EDGE_STORE)).toEqual([
      expect.objectContaining({ kind: "opener", from: source?.id, to: node?.id, weight: 1 }),
    ]);
  });

  it("links only a tab's first page to its opener", async () => {
    const api = createApi(sessionTab({ id: 3 }), sessionTab({ openerTabId: 3 }));
    await recordNavigation({ database, api, navigation: commit({ tabId: 3 }) });
    await recordNavigation({ database, api, navigation: commit() });

    const second = await recordNavigation({
      database,
      api,
      navigation: commit({ url: "https://example.org/c" }),
    });

    expect(second?.openerNodeId).toBeNull();
  });

  it("gives a page the URL as its title until the tab reports the page's own", async () => {
    const api = createApi(sessionTab({ url: "https://example.org/previous", title: "Previous" }));

    const node = await recordNavigation({ database, api, navigation: commit() });

    expect(node?.title).toBe("https://example.org/a");
  });

  it.each([
    ["a reload", commit({ transitionType: "reload" })],
    ["a subframe", commit({ frameId: 3 })],
    ["a browser page", commit({ url: "about:newtab" })],
  ])("records nothing for %s", async (_case, navigation) => {
    await recordNavigation({ database, api: createApi(sessionTab()), navigation });

    expect(await readNodes()).toHaveLength(0);
  });

  it("closes the page a session tab leaves for a browser page", async () => {
    const api = createApi(sessionTab());
    const node = await recordNavigation({ database, api, navigation: commit() });

    await recordNavigation({ database, api, navigation: commit({ url: "about:blank" }) });

    expect(await database.get(NODE_STORE, node?.id ?? "")).toMatchObject({ tabState: "closed" });
    expect(await readNodes()).toHaveLength(1);
  });

  it("ignores a tab outside the session's group", async () => {
    await recordNavigation({
      database,
      api: createApi(sessionTab({ groupId: -1 })),
      navigation: commit(),
    });

    expect(await readNodes()).toHaveLength(0);
  });

  it("ignores a private tab", async () => {
    await recordNavigation({
      database,
      api: createApi(sessionTab({ incognito: true })),
      navigation: commit(),
    });

    expect(await readNodes()).toHaveLength(0);
  });

  it("records nothing, and asks the browser nothing, without an active session", async () => {
    await database.clear(SESSION_STORE);
    const api = createApi(sessionTab());

    await recordNavigation({ database, api, navigation: commit() });

    expect(api.getTab).not.toHaveBeenCalled();
    expect(await readNodes()).toHaveLength(0);
  });
});
