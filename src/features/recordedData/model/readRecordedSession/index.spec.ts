import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { readRecordedSession } from ".";
import { readRecordedText } from "../readRecordedText";
import { recordSnapshot } from "@/features/pageSnapshots";
import {
  EXTRACTION_STORE,
  KEY_STORE,
  MODEL_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  SNAPSHOT_STORE,
  type StoredNode,
  VECTOR_STORE,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const SIGNALS = {
  activeDwellMs: 120_000,
  maxScroll: 0.8,
  copyEvents: 1,
  pasteEvents: 0,
  focusCount: 3,
  revisitCount: 1,
  quickReturnCount: 0,
};

const node = (id: string, overrides: Partial<StoredNode> = {}): StoredNode => ({
  id,
  sessionId: "session-1",
  tabId: 7,
  kind: "page",
  url: `https://example.org/${id}`,
  domain: "example.org",
  title: `Page ${id}`,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  signals: SIGNALS,
  tabState: "open",
  createdAt: 1,
  ...overrides,
});

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all(
    (
      [
        SESSION_STORE,
        NODE_STORE,
        SNAPSHOT_STORE,
        VECTOR_STORE,
        KEY_STORE,
        EXTRACTION_STORE,
        MODEL_STORE,
      ] as const
    ).map((store) => database.clear(store)),
  );
  await database.put(SESSION_STORE, {
    id: "session-1",
    title: "E-bike motors",
    groupId: 42,
    formerGroupIds: [],
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });
  await database.put(NODE_STORE, node("a", { createdAt: 2 }));
  await database.put(NODE_STORE, node("b", { createdAt: 1, tabState: "closed" }));
  await database.put(NODE_STORE, node("elsewhere", { sessionId: "session-0" }));
  await recordSnapshot(database, {
    nodeId: "a",
    text: "Mid-drive motors sit at the cranks.",
    truncated: false,
    extractorVersion: "readability@0.6.0/1",
    capturedAt: 9,
  });
  await Promise.all(
    [0, 1].map((part) =>
      database.put(VECTOR_STORE, {
        spaceId: "space-1",
        chunkId: "x:0",
        part,
        nodeId: "a",
        sessionId: "session-1",
        vector: new Float32Array([1]),
      }),
    ),
  );
});

describe("readRecordedSession", () => {
  it("lists the live session's pages, oldest first, with what was kept about each", async () => {
    const recorded = await readRecordedSession(database, "session-1");

    expect(recorded).toMatchObject({ id: "session-1", title: "E-bike motors", status: "active" });
    expect(recorded?.pages.map(({ id }) => id)).toEqual(["b", "a"]);
    expect(recorded?.pages[1]).toMatchObject({
      title: "Page a",
      url: "https://example.org/a",
      signals: SIGNALS,
      snapshot: { byteLength: 35, truncated: false, capturedAt: 9 },
      vectorCount: 2,
    });
    expect(recorded?.pages[0]).toMatchObject({
      tabState: "closed",
      snapshot: null,
      vectorCount: 0,
    });
  });

  it("counts a page's facts kept and dropped, and none for a page not extracted", async () => {
    const snapshotId = (await database.get(NODE_STORE, "a"))?.snapshotId ?? "";

    await database.put(EXTRACTION_STORE, {
      snapshotId,
      sessionId: "session-1",
      nodeId: "a",
      modelRef: "m",
      prompt: "factExtraction@1",
      chunkCount: 2,
      chunkOutcomes: [{ kept: 7, dropped: 2, isInvalid: false }],
      chunksDone: 1,
      keptCount: 7,
      droppedCount: 2,
      invalidChunkCount: 0,
    });

    const recorded = await readRecordedSession(database, "session-1");

    expect(recorded?.pages[1]?.facts).toEqual({ kept: 7, dropped: 2, isFinished: false });
    expect(recorded?.pages[0]?.facts).toBeNull();
  });

  it("says whether facts can be extracted: only with an active generation model", async () => {
    expect((await readRecordedSession(database, "session-1"))?.canExtractFacts).toBe(false);

    await database.put(MODEL_STORE, {
      ref: "ollama:qwen3:4b@abc",
      manifest: { contract: { family: "text-generation" } },
      active: true,
      conformance: "passed",
      installedAt: 1,
    } as never);

    expect((await readRecordedSession(database, "session-1"))?.canExtractFacts).toBe(true);
  });

  it("never includes a page's text", async () => {
    expect(JSON.stringify(await readRecordedSession(database, "session-1"))).not.toContain(
      "cranks",
    );
  });

  it("gives nothing without a live session", async () => {
    await database.clear(SESSION_STORE);

    expect(await readRecordedSession(database, "session-1")).toBeUndefined();
  });
});

describe("readRecordedText", () => {
  it("returns a page's text, decrypted", async () => {
    expect(await readRecordedText(database, "session-1", "a")).toBe(
      "Mid-drive motors sit at the cranks.",
    );
  });

  it("returns nothing for a page without text, or of another session", async () => {
    expect(await readRecordedText(database, "session-1", "b")).toBeNull();
    expect(await readRecordedText(database, "session-1", "elsewhere")).toBeNull();
  });
});
