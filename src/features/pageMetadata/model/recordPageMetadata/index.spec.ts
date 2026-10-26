import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { recordPageMetadata } from ".";
import {
  KEY_STORE,
  NODE_STORE,
  openResearchDatabase,
  PAGE_METADATA_STORE,
  type ResearchDatabaseSchema,
  type StoredNode,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const buildNode = (id: string, title = "Tab title"): StoredNode => ({
  id,
  sessionId: "session-1",
  tabId: 7,
  kind: "page",
  url: `https://example.org/${id}`,
  domain: "example.org",
  title,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  signals: {
    activeDwellMs: 0,
    maxScroll: 0,
    copyEvents: 0,
    pasteEvents: 0,
    focusCount: 1,
    revisitCount: 0,
    quickReturnCount: 0,
  },
  tabState: "open",
  createdAt: 1,
});

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all([
    database.clear(NODE_STORE),
    database.clear(PAGE_METADATA_STORE),
    database.clear(KEY_STORE),
  ]);
  await database.put(NODE_STORE, buildNode("a"));
});

describe("recordPageMetadata", () => {
  it("stores the fields against the node, and seals the description", async () => {
    const stored = await recordPageMetadata(database, {
      nodeId: "a",
      metadata: {
        title: "Mid-drive motors",
        description: "How they work.",
        siteName: "Bike Lab",
        canonicalUrl: "https://example.org/a",
      },
      capturedAt: 500,
    });

    expect(stored).toMatchObject({
      nodeId: "a",
      sessionId: "session-1",
      capturedAt: 500,
      title: "Mid-drive motors",
      siteName: "Bike Lab",
      canonicalUrl: "https://example.org/a",
      cipher: "aes-gcm-256",
    });
    expect(stored?.iv).toBeInstanceOf(Uint8Array);
    expect(await database.get(PAGE_METADATA_STORE, "a")).toMatchObject({
      nodeId: "a",
      title: "Mid-drive motors",
      keyId: stored?.keyId,
    });
    expect(JSON.stringify(stored)).not.toContain("How they work.");
    expect(stored).not.toHaveProperty("description");
  });

  it("stores no seal when the page gave no description", async () => {
    const stored = await recordPageMetadata(database, {
      nodeId: "a",
      metadata: { title: "Mid-drive motors" },
      capturedAt: 500,
    });

    expect(stored).not.toHaveProperty("encryptedDescription");
    expect(stored).not.toHaveProperty("iv");
  });

  it("replaces an earlier record of the node", async () => {
    await recordPageMetadata(database, {
      nodeId: "a",
      metadata: { title: "First", siteName: "Old site" },
      capturedAt: 500,
    });
    await recordPageMetadata(database, {
      nodeId: "a",
      metadata: { title: "Second" },
      capturedAt: 600,
    });

    expect(await database.count(PAGE_METADATA_STORE)).toBe(1);
    expect(await database.get(PAGE_METADATA_STORE, "a")).toMatchObject({
      title: "Second",
      capturedAt: 600,
    });
    expect(await database.get(PAGE_METADATA_STORE, "a")).not.toHaveProperty("siteName");
  });

  it("gives a node whose title is only its address the page's title", async () => {
    await database.put(NODE_STORE, buildNode("b", "https://example.org/b"));
    await recordPageMetadata(database, {
      nodeId: "b",
      metadata: { title: "Mid-drive motors" },
      capturedAt: 500,
    });

    expect((await database.get(NODE_STORE, "b"))?.title).toBe("Mid-drive motors");
  });

  it("gives a node with a blank title the page's title", async () => {
    await database.put(NODE_STORE, buildNode("b", ""));
    await recordPageMetadata(database, {
      nodeId: "b",
      metadata: { title: "Mid-drive motors" },
      capturedAt: 500,
    });

    expect((await database.get(NODE_STORE, "b"))?.title).toBe("Mid-drive motors");
  });

  it("leaves a good tab title alone", async () => {
    await recordPageMetadata(database, {
      nodeId: "a",
      metadata: { title: "Something else" },
      capturedAt: 500,
    });

    expect((await database.get(NODE_STORE, "a"))?.title).toBe("Tab title");
  });

  it("stores nothing for a node that does not exist, or a page that said nothing", async () => {
    expect(
      await recordPageMetadata(database, {
        nodeId: "gone",
        metadata: { title: "x" },
        capturedAt: 500,
      }),
    ).toBeUndefined();
    expect(await recordPageMetadata(database, { nodeId: "a", metadata: {}, capturedAt: 500 })).toBe(
      undefined,
    );
    expect(await database.count(PAGE_METADATA_STORE)).toBe(0);
  });
});
