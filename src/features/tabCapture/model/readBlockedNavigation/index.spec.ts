import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveBlockedSites } from "@/features/siteDenylist";
import {
  BLOCKED_SITES_STORE,
  EDGE_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
} from "@/shared/storage";

import { readBlockedNavigation } from ".";
import type { CaptureTab, CommittedNavigation, TabCaptureApi } from "../../types";

const GROUP_ID = 42;

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all(
    ([SESSION_STORE, NODE_STORE, EDGE_STORE, BLOCKED_SITES_STORE] as const).map((store) =>
      database.clear(store),
    ),
  );
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

const sessionTab = (overrides: Partial<CaptureTab> = {}): CaptureTab => ({
  id: 7,
  url: "https://www.paypal.com/myaccount",
  title: "PayPal",
  groupId: GROUP_ID,
  incognito: false,
  ...overrides,
});

const createApi = (tab: CaptureTab): TabCaptureApi => ({
  getTab: vi.fn(() => Promise.resolve(tab)),
  queryGroupTabs: vi.fn(() => Promise.resolve([tab])),
});

const commit = (overrides: Partial<CommittedNavigation> = {}): CommittedNavigation => ({
  tabId: 7,
  frameId: 0,
  url: "https://www.paypal.com/myaccount",
  transitionType: "link",
  ...overrides,
});

const read = (navigation: CommittedNavigation, tab = sessionTab()) =>
  readBlockedNavigation({ database, api: createApi(tab), navigation });

describe("readBlockedNavigation", () => {
  it("names the session and the host of a denylisted page in a session tab", async () => {
    expect(await read(commit())).toEqual({
      sessionId: "session-1",
      sessionTitle: "E-bike motors",
      host: "www.paypal.com",
    });
  });

  it("names a site the user added", async () => {
    await saveBlockedSites(database, ["myclinic.example"]);

    expect(await read(commit({ url: "https://portal.myclinic.example/a" }))).toMatchObject({
      host: "portal.myclinic.example",
    });
  });

  it("says nothing of a page that is not on the denylist or not a web page", async () => {
    expect(await read(commit({ url: "https://example.org/a" }))).toBeUndefined();
    expect(await read(commit({ url: "about:preferences" }))).toBeUndefined();
    expect(await read(commit({ url: "moz-extension://uuid/popup.html" }))).toBeUndefined();
  });

  it("says nothing of a frame inside the page", async () => {
    expect(await read(commit({ frameId: 3 }))).toBeUndefined();
  });

  it("says nothing of a tab outside a session or in a private window", async () => {
    expect(await read(commit(), sessionTab({ groupId: 99 }))).toBeUndefined();
    expect(await read(commit(), sessionTab({ incognito: true }))).toBeUndefined();
  });

  it("says nothing without an active session, and does not ask the browser about the tab", async () => {
    await database.put(SESSION_STORE, {
      id: "session-1",
      title: "E-bike motors",
      groupId: GROUP_ID,
      formerGroupIds: [],
      status: "ended",
      createdAt: 1,
      updatedAt: 1,
    } as never);

    const api = createApi(sessionTab());

    expect(await readBlockedNavigation({ database, api, navigation: commit() })).toBeUndefined();
    expect(api.getTab).not.toHaveBeenCalled();
  });

  it("stores nothing about the page", async () => {
    await read(commit());

    expect(await database.getAll(NODE_STORE)).toEqual([]);
    expect(await database.getAll(EDGE_STORE)).toEqual([]);
  });
});
