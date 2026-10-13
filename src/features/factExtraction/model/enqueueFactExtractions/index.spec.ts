import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { enqueueFactExtractions } from ".";
import { completeJob } from "@/features/jobQueue";
import { recordSnapshot } from "@/features/pageSnapshots";
import {
  EXTRACTION_STORE,
  JOB_STORE,
  KEY_STORE,
  MODEL_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  SNAPSHOT_STORE,
  type StoredModel,
  type StoredNode,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const GENERATION_MODEL = {
  ref: "ollama:qwen3:4b@abc",
  manifest: {
    reference: { hub: "ollama", repository: "qwen3:4b", revision: "abc" },
    contract: { family: "text-generation", contextWindow: 40_960 },
  },
  active: true,
  conformance: "passed",
  diskBytes: 1,
  installedAt: 1,
} as unknown as StoredModel;

const node = (id: string): StoredNode => ({
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

const snapshotOf = (nodeId: string, text: string) =>
  recordSnapshot(database, {
    nodeId,
    text,
    truncated: false,
    extractorVersion: "readability@0.6.0/1",
    capturedAt: 1,
  });

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all(
    (
      [
        SESSION_STORE,
        NODE_STORE,
        SNAPSHOT_STORE,
        KEY_STORE,
        MODEL_STORE,
        JOB_STORE,
        EXTRACTION_STORE,
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
  await database.put(NODE_STORE, node("a"));
  await database.put(NODE_STORE, node("b"));
  await database.put(NODE_STORE, node("unread"));
  await snapshotOf("a", "Mid-drive motors sit at the cranks.");
  await snapshotOf("b", "Hub motors sit in the wheel.");
});

describe("enqueueFactExtractions", () => {
  it("queues one job per snapshot, below embedding, with the prompt and model in its identity", async () => {
    await database.put(MODEL_STORE, GENERATION_MODEL);

    const jobs = await enqueueFactExtractions(database);

    expect(jobs).toHaveLength(2);
    expect(jobs.every(({ type }) => type === "extractFacts")).toBe(true);
    expect(jobs.every(({ priority }) => priority < 0)).toBe(true);
    expect(jobs[0]?.producerVersion).toMatch(/^factExtraction@1\|ollama:qwen3:4b@abc\|/u);
    expect(jobs.map(({ payload }) => payload)).toEqual(
      expect.arrayContaining([{ snapshotId: expect.any(String) }]),
    );
  });

  it("queues nothing without an active text-generation model", async () => {
    await database.put(MODEL_STORE, { ...GENERATION_MODEL, active: false });

    expect(await enqueueFactExtractions(database)).toEqual([]);
    expect(await database.count(JOB_STORE)).toBe(0);
  });

  it("queues nothing without an active session", async () => {
    await database.put(MODEL_STORE, GENERATION_MODEL);
    await database.put(SESSION_STORE, {
      ...(await database.get(SESSION_STORE, "session-1"))!,
      status: "saved",
    });

    expect(await enqueueFactExtractions(database)).toEqual([]);
  });

  it("does not queue a page twice, even once its extraction is done", async () => {
    await database.put(MODEL_STORE, GENERATION_MODEL);

    const [first] = await enqueueFactExtractions(database);

    await completeJob(database, first!.id);
    await enqueueFactExtractions(database);

    expect(await database.count(JOB_STORE)).toBe(2);
  });

  it("queues a page extracted by another model no more, keeping its facts (REQ-LIN-005)", async () => {
    await database.put(MODEL_STORE, GENERATION_MODEL);

    const [first] = await enqueueFactExtractions(database);
    const snapshotId = (first!.payload as { snapshotId: string }).snapshotId;

    await database.put(EXTRACTION_STORE, {
      snapshotId,
      sessionId: "session-1",
      nodeId: "a",
    } as never);
    await database.put(MODEL_STORE, { ...GENERATION_MODEL, active: false });
    await database.put(MODEL_STORE, { ...GENERATION_MODEL, ref: "ollama:qwen3:8b@def" });

    const again = await enqueueFactExtractions(database);

    expect(again.map(({ payload }) => payload)).not.toContainEqual({ snapshotId });
    expect(again).toHaveLength(1);
  });

  it("queues the pages not yet extracted for another model", async () => {
    await database.put(MODEL_STORE, GENERATION_MODEL);
    await enqueueFactExtractions(database);
    await database.put(MODEL_STORE, { ...GENERATION_MODEL, active: false });
    await database.put(MODEL_STORE, { ...GENERATION_MODEL, ref: "ollama:qwen3:8b@def" });
    await enqueueFactExtractions(database);

    expect(await database.count(JOB_STORE)).toBe(4);
  });
});
