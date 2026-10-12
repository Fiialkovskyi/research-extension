import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { readSnapshotText } from ".";
import { recordSnapshot } from "../recordSnapshot";
import {
  KEY_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SNAPSHOT_STORE,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all([
    database.clear(NODE_STORE),
    database.clear(SNAPSHOT_STORE),
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
      copyEvents: 1,
      focusCount: 1,
      revisitCount: 0,
      quickReturnCount: 0,
    },
    tabState: "open",
    createdAt: 1,
  });
});

const store = (text: string) =>
  recordSnapshot(database, {
    nodeId: "a",
    text,
    truncated: false,
    extractorVersion: "readability@0.6.0/1",
    capturedAt: 1,
  });

describe("readSnapshotText", () => {
  it("returns the stored text, decrypted and inflated", async () => {
    const snapshot = await store("Mid-drive motors — torque and ж.");

    expect(await readSnapshotText(database, snapshot?.id ?? "")).toBe(
      "Mid-drive motors — torque and ж.",
    );
  });

  it("returns nothing for a snapshot that does not exist", async () => {
    expect(await readSnapshotText(database, "missing")).toBeUndefined();
  });

  it("refuses a snapshot whose ciphertext was altered", async () => {
    const snapshot = await store("Mid-drive motors sit at the cranks.");
    const stored = await database.get(SNAPSHOT_STORE, snapshot?.id ?? "");
    const altered = new Uint8Array((stored?.encryptedText ?? new ArrayBuffer(1)).slice(0));

    altered[0] = (altered[0] ?? 0) ^ 1;
    await database.put(SNAPSHOT_STORE, { ...stored!, encryptedText: altered.buffer });

    await expect(readSnapshotText(database, snapshot?.id ?? "")).rejects.toThrow(
      "failed authentication",
    );
  });
});
