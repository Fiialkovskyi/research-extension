import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { saveBlockedSites } from "@/features/siteDenylist";
import { followTabMembership } from ".";
import type { CaptureTab } from "../../types";
import {
  EDGE_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  BLOCKED_SITES_STORE,
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
    database.clear(BLOCKED_SITES_STORE),
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

describe("followTabMembership", () => {
  it("records a tab dragged into the group from the page it shows", async () => {
    await followTabMembership({ database, tab: sessionTab() });

    expect(await readNodes()).toEqual([
      expect.objectContaining({
        url: "https://example.org/a",
        title: "A",
        transitionType: "joined",
      }),
    ]);
  });

  it("leaves a joining tab on a site the user added unrecorded", async () => {
    await saveBlockedSites(database, ["example.org"]);
    await followTabMembership({ database, tab: sessionTab() });

    expect(await readNodes()).toEqual([]);
  });

  it("links a joining tab to the page of the tab that opened it", async () => {
    await followTabMembership({ database, tab: sessionTab({ id: 3 }) });
    const [source] = await readNodes();

    await followTabMembership({
      database,
      tab: sessionTab({ url: "https://example.org/b", openerTabId: 3 }),
    });

    expect(await database.getAll(EDGE_STORE)).toEqual([
      expect.objectContaining({ kind: "opener", from: source?.id }),
    ]);
  });

  it("records a tab only once, however often its membership is reported", async () => {
    await followTabMembership({ database, tab: sessionTab() });
    await followTabMembership({ database, tab: sessionTab() });

    expect(await readNodes()).toHaveLength(1);
  });

  it("leaves a tab joining on a browser page to its first commit", async () => {
    await followTabMembership({ database, tab: sessionTab({ url: "about:newtab" }) });

    expect(await readNodes()).toHaveLength(0);
  });

  it("closes the node of a tab that left the group", async () => {
    await followTabMembership({ database, tab: sessionTab() });

    await followTabMembership({ database, tab: sessionTab({ groupId: -1 }) });

    expect(await readNodes()).toEqual([expect.objectContaining({ tabState: "closed" })]);
  });

  it("records nothing for a tab that joins on a denylisted page", async () => {
    await followTabMembership({
      database,
      tab: sessionTab({ url: "https://mail.google.com/mail/u/0/" }),
    });

    expect(await readNodes()).toHaveLength(0);
  });

  it("ignores a private tab", async () => {
    await followTabMembership({ database, tab: sessionTab({ incognito: true }) });

    expect(await readNodes()).toHaveLength(0);
  });

  it("records a tab dragged in while it shows a search as a SERP", async () => {
    await followTabMembership({
      database,
      tab: sessionTab({ url: "https://www.bing.com/search?q=hub+motor" }),
    });

    expect(await readNodes()).toEqual([
      expect.objectContaining({ kind: "serp", query: "hub motor", domain: "www.bing.com" }),
    ]);
  });
});
