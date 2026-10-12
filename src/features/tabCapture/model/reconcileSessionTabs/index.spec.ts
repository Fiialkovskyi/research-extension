import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { reconcileSessionTabs } from ".";
import { followTabMembership } from "../followTabMembership";
import type { CaptureTab, TabCaptureApi } from "../../types";
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

const createApi = (...tabs: CaptureTab[]): TabCaptureApi => ({
  getTab: vi.fn(),
  queryGroupTabs: vi.fn(async () => tabs),
});

describe("reconcileSessionTabs", () => {
  it("keeps a node whose tab came back with the same id and page", async () => {
    await followTabMembership({ database, tab: sessionTab() });

    await reconcileSessionTabs({ database, api: createApi(sessionTab()) });

    expect(await readNodes()).toEqual([expect.objectContaining({ tabState: "open" })]);
  });

  it("closes a node whose tab did not come back", async () => {
    await followTabMembership({ database, tab: sessionTab() });

    await reconcileSessionTabs({ database, api: createApi() });

    expect(await readNodes()).toEqual([expect.objectContaining({ tabState: "closed" })]);
  });

  it("records a restored tab that reused an old id for another page", async () => {
    await followTabMembership({ database, tab: sessionTab() });

    await reconcileSessionTabs({
      database,
      api: createApi(sessionTab({ url: "https://example.org/z", title: "Z" })),
    });

    const nodes = await readNodes();

    expect(nodes.filter((node) => node.tabState === "open")).toEqual([
      expect.objectContaining({ url: "https://example.org/z", transitionType: "restored" }),
    ]);
    expect(nodes).toHaveLength(2);
  });

  it("leaves browser pages and private tabs unrecorded", async () => {
    await reconcileSessionTabs({
      database,
      api: createApi(sessionTab({ url: "about:newtab" }), sessionTab({ id: 8, incognito: true })),
    });

    expect(await readNodes()).toHaveLength(0);
  });

  it("asks the browser nothing without an active session", async () => {
    await database.clear(SESSION_STORE);
    const api = createApi();

    await reconcileSessionTabs({ database, api });

    expect(api.queryGroupTabs).not.toHaveBeenCalled();
  });

  it("records a restored tab that shows a search as a SERP", async () => {
    await reconcileSessionTabs({
      database,
      api: createApi(sessionTab({ id: 12, url: "https://kagi.com/search?q=bafang" })),
    });

    expect(await readNodes()).toEqual([
      expect.objectContaining({ kind: "serp", query: "bafang", transitionType: "restored" }),
    ]);
  });
});
