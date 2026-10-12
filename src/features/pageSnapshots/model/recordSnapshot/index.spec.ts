import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { recordSnapshot } from ".";
import { readSnapshotText } from "../readSnapshotText";
import {
  KEY_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SNAPSHOT_STORE,
  type StoredNode,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const buildNode = (id: string): StoredNode => ({
  id,
  sessionId: "session-1",
  tabId: 7,
  kind: "page",
  url: `https://example.org/${id}`,
  domain: "example.org",
  title: id,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  signals: {
    activeDwellMs: 0,
    maxScroll: 0,
    copyEvents: 1,
    focusCount: 1,
    revisitCount: 0,
    quickReturnCount: 0,
  },
  tabState: "open",
  createdAt: 1,
});

const extract = (nodeId: string, text = "Mid-drive motors sit at the cranks.") => ({
  nodeId,
  text,
  truncated: false,
  extractorVersion: "readability@0.6.0/1",
  capturedAt: 500,
});

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all([
    database.clear(NODE_STORE),
    database.clear(SNAPSHOT_STORE),
    database.clear(KEY_STORE),
  ]);
  await database.put(NODE_STORE, buildNode("a"));
  await database.put(NODE_STORE, buildNode("b"));
});

describe("recordSnapshot", () => {
  it("stores the text against its node, and gives the node its id and hash", async () => {
    const snapshot = await recordSnapshot(database, extract("a"));
    const node = await database.get(NODE_STORE, "a");

    expect(snapshot).toMatchObject({
      sessionId: "session-1",
      nodeId: "a",
      byteLength: 35,
      truncated: false,
      extractorVersion: "readability@0.6.0/1",
      capturedAt: 500,
    });
    expect(snapshot?.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(node).toMatchObject({ snapshotId: snapshot?.id, contentHash: snapshot?.contentHash });
  });

  it("stores the text only encrypted, naming the key and cipher", async () => {
    const snapshot = await recordSnapshot(
      database,
      extract("a", "A mid-drive motor sits at the cranks. ".repeat(20)),
    );
    const stored = await database.get(SNAPSHOT_STORE, snapshot?.id ?? "");
    const storedBytes = new TextDecoder("latin1").decode(stored?.encryptedText);

    expect(stored).toMatchObject({ keyId: "data-key-1", cipher: "aes-gcm-256" });
    expect(stored?.iv).toHaveLength(12);
    expect(stored).not.toHaveProperty("compressedText");
    expect(storedBytes).not.toContain("mid-drive");
    // Repetitive text gzips to a run of repeated bytes; ciphertext has none.
    expect(storedBytes).not.toMatch(/(.{4})\1{3}/s);
  });

  it("stores text that reads back as it was sent", async () => {
    const snapshot = await recordSnapshot(database, extract("a"));

    expect(await readSnapshotText(database, snapshot?.id ?? "")).toBe(
      "Mid-drive motors sit at the cranks.",
    );
  });

  it("keeps one snapshot per node", async () => {
    const first = await recordSnapshot(database, extract("a"));

    expect(await recordSnapshot(database, extract("a", "Other text"))).toBeUndefined();
    expect(await database.count(SNAPSHOT_STORE)).toBe(1);
    expect((await database.get(NODE_STORE, "a"))?.snapshotId).toBe(first?.id);
  });

  it("gives two pages with the same text the same hash", async () => {
    const a = await recordSnapshot(database, extract("a"));
    const b = await recordSnapshot(database, extract("b"));

    expect(a?.contentHash).toBe(b?.contentHash);
    expect(a?.id).not.toBe(b?.id);
  });

  it("records that the page cut the text", async () => {
    expect(await recordSnapshot(database, { ...extract("a"), truncated: true })).toMatchObject({
      truncated: true,
    });
  });

  it("stores nothing for empty text", async () => {
    expect(await recordSnapshot(database, extract("a", "  \n "))).toBeUndefined();
    expect(await database.count(SNAPSHOT_STORE)).toBe(0);
  });

  it("stores nothing for a node that does not exist", async () => {
    expect(await recordSnapshot(database, extract("missing"))).toBeUndefined();
    expect(await database.count(SNAPSHOT_STORE)).toBe(0);
  });
});
