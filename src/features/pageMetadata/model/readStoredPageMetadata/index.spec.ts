import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { readStoredPageMetadata } from ".";
import { recordPageMetadata } from "../recordPageMetadata";
import {
  KEY_STORE,
  NODE_STORE,
  openResearchDatabase,
  PAGE_METADATA_STORE,
  type ResearchDatabaseSchema,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all([
    database.clear(NODE_STORE),
    database.clear(PAGE_METADATA_STORE),
    database.clear(KEY_STORE),
  ]);
  await database.put(NODE_STORE, {
    id: "a",
    sessionId: "session-1",
    tabId: 7,
    kind: "page",
    url: "https://example.org/a",
    domain: "example.org",
    title: "A",
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
});

describe("readStoredPageMetadata", () => {
  it("returns what was stored, the description opened", async () => {
    await recordPageMetadata(database, {
      nodeId: "a",
      metadata: { title: "Mid-drive motors", description: "How they work — in détail." },
      capturedAt: 500,
    });

    expect(await readStoredPageMetadata(database, "a")).toEqual({
      nodeId: "a",
      capturedAt: 500,
      title: "Mid-drive motors",
      description: "How they work — in détail.",
    });
  });

  it("returns a record with no description as it is", async () => {
    await recordPageMetadata(database, {
      nodeId: "a",
      metadata: { title: "Mid-drive motors" },
      capturedAt: 500,
    });

    expect(await readStoredPageMetadata(database, "a")).toEqual({
      nodeId: "a",
      capturedAt: 500,
      title: "Mid-drive motors",
    });
  });

  it("returns nothing for a node without metadata", async () => {
    expect(await readStoredPageMetadata(database, "a")).toBeUndefined();
  });

  it("refuses a description whose ciphertext was altered", async () => {
    await recordPageMetadata(database, {
      nodeId: "a",
      metadata: { description: "How they work." },
      capturedAt: 500,
    });

    const record = await database.get(PAGE_METADATA_STORE, "a");
    const altered = new Uint8Array(record?.encryptedDescription ?? new ArrayBuffer(0));

    altered[0] = (altered[0] ?? 0) ^ 1;
    await database.put(PAGE_METADATA_STORE, {
      ...(record as NonNullable<typeof record>),
      encryptedDescription: altered.buffer,
    });

    await expect(readStoredPageMetadata(database, "a")).rejects.toThrow();
  });
});
