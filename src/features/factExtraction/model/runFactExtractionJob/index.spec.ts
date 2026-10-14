import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { runFactExtractionJob } from ".";
import { getDataKey } from "@/features/dataProtection";
import type { GenerateRequest, GenerationStream } from "@/features/inference";
import { recordSnapshot } from "@/features/pageSnapshots";
import { chunkText } from "@/features/snapshotEmbeddings";

import { readSealedFact } from "../readSealedFact";
import {
  CHUNK_STORE,
  EXTRACTION_STORE,
  FACT_STORE,
  INFERENCE_RUN_STORE,
  JOB_STORE,
  NODE_STORE,
  openResearchDatabase,
  type StoredJob,
} from "@/shared/storage";

/** Long enough for three chunks: each sentence states one weight. */
const TEXT = Array.from(
  { length: 120 },
  (_, index) => `Model ${index} weighs ${index + 10} kg on the shop scale today.`,
).join(" ");

/** The passage a request carries, read back out of its delimiters. */
const readPassage = (request: GenerateRequest): string =>
  /<page_text>\n([\s\S]*)\n<\/page_text>$/u.exec(request.messages[1]?.content ?? "")?.[1] ?? "";

/** A stream that answers at once with `text`. */
const answerWith = (text: string): GenerationStream => ({
  final: () => Promise.resolve({ text, device: "local-server", stoppedBecause: "model" }),
  async *[Symbol.asyncIterator]() {
    yield { delta: text };
  },
});

/**
 * A model that answers each chunk with two facts: the first quotes the
 * chunk's first sentence, the second quotes something the page never says.
 */
const honestAndInventive = (request: GenerateRequest): GenerationStream => {
  const firstSentence = readPassage(request).split(". ")[0] ?? "";

  return answerWith(
    JSON.stringify({
      entities: [],
      facts: [
        { subject: "Model", attribute: "weight", value: "1", quote: firstSentence },
        { subject: "Model", attribute: "colour", value: "red", quote: "comes in red" },
      ],
    }),
  );
};

let snapshotId: string;
let job: StoredJob;

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all(
    ([FACT_STORE, EXTRACTION_STORE, CHUNK_STORE, JOB_STORE, INFERENCE_RUN_STORE] as const).map(
      (store) => database.clear(store),
    ),
  );

  // A fresh node each time: a node with a snapshot takes no second one.
  await database.put(NODE_STORE, {
    id: "node-a",
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

  const snapshot = await recordSnapshot(database, {
    nodeId: "node-a",
    text: TEXT,
    truncated: false,
    extractorVersion: "readability@0.6.0/1",
    capturedAt: 1,
  });

  if (snapshot === undefined) {
    throw new Error("No snapshot was recorded.");
  }

  snapshotId = snapshot.id;
  job = {
    id: "job-1",
    type: "extractFacts",
    inputHashes: [snapshotId],
    producerVersion: "p",
    status: "running",
    priority: -10,
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: 0,
    updatedAt: 0,
    payload: { snapshotId },
  };
  await database.put(JOB_STORE, job);
});

const run = async (overrides: Partial<Parameters<typeof runFactExtractionJob>[0]> = {}) =>
  runFactExtractionJob({
    database: await openResearchDatabase(),
    job,
    modelRef: "ollama:qwen3:4b@abc",
    generate: honestAndInventive,
    mayContinue: () => Promise.resolve(true),
    now: () => 1_000,
    ...overrides,
  });

const CHUNK_COUNT = chunkText(TEXT).length;

describe("runFactExtractionJob", () => {
  it("stores the grounded fact of every chunk, encrypted, and counts the invented one", async () => {
    expect(CHUNK_COUNT).toBeGreaterThan(2);
    expect(await run()).toBeUndefined();

    const database = await openResearchDatabase();
    const facts = await database.getAll(FACT_STORE);

    expect(facts).toHaveLength(CHUNK_COUNT);
    expect(facts[0]).toMatchObject({
      snapshotId,
      nodeId: "node-a",
      provenance: {
        modelRef: "ollama:qwen3:4b@abc",
        prompt: "factExtraction@1",
        chunkerVersion: "chunker@1",
      },
    });
    expect(JSON.stringify(facts)).not.toContain("weighs");
    expect(await database.get(EXTRACTION_STORE, snapshotId)).toMatchObject({
      chunkCount: CHUNK_COUNT,
      chunksDone: CHUNK_COUNT,
      keptCount: CHUNK_COUNT,
      droppedCount: CHUNK_COUNT,
      invalidChunkCount: 0,
      finishedAt: 1_000,
    });
    expect(await database.count(CHUNK_STORE)).toBe(CHUNK_COUNT);
  });

  it("keeps each fact's subject type as the answer listed it, and unknown otherwise", async () => {
    await run({
      generate: (request) => {
        const firstSentence = readPassage(request).split(". ")[0] ?? "";

        return answerWith(
          JSON.stringify({
            entities: [{ name: "MODEL  ", entity_type: "product" }],
            facts: [
              { subject: "Model", attribute: "weight", value: "1", quote: firstSentence },
              { subject: "Scale", attribute: "kind", value: "shop", quote: firstSentence },
            ],
          }),
        );
      },
    });

    const database = await openResearchDatabase();
    const dataKey = await getDataKey(database);
    const facts = await Promise.all(
      (await database.getAll(FACT_STORE)).map((fact) => readSealedFact(dataKey, fact)),
    );

    expect(facts.find(({ subject }) => subject === "Model")?.entityType).toBe("product");
    expect(facts.find(({ subject }) => subject === "Scale")?.entityType).toBe("unknown");
  });

  it("sends each chunk as delimited data, bounded, in the schema, with its context", async () => {
    const generate = vi.fn(honestAndInventive);

    await run({ generate });

    expect(generate).toHaveBeenCalledTimes(CHUNK_COUNT);
    expect(generate.mock.calls[0]?.[0]).toMatchObject({
      maxTokens: 1_024,
      temperature: 0,
      contextTokens: 4_096,
      responseSchema: expect.objectContaining({ required: ["entities", "facts"] }),
    });
  });

  it("counts an answer outside the schema and moves on to the next chunk", async () => {
    let calls = 0;

    await run({
      generate: (request) => {
        calls += 1;
        return calls === 2 ? answerWith("Sure! Here are some facts.") : honestAndInventive(request);
      },
    });

    const database = await openResearchDatabase();

    expect(await database.count(FACT_STORE)).toBe(CHUNK_COUNT - 1);
    expect(await database.get(EXTRACTION_STORE, snapshotId)).toMatchObject({
      chunksDone: CHUNK_COUNT,
      invalidChunkCount: 1,
    });
    expect((await database.getAll(INFERENCE_RUN_STORE)).map(({ outcome }) => outcome)).toContain(
      "failed",
    );
  });

  it("resumes at its checkpoint without asking again for the chunks done", async () => {
    const generate = vi.fn(honestAndInventive);

    job = { ...job, checkpoint: { nextChunk: 1 } };
    await run({ generate });

    expect(generate).toHaveBeenCalledTimes(CHUNK_COUNT - 1);
  });

  it("stores nothing twice when a chunk is redone after its checkpoint was lost", async () => {
    await run();
    await run();

    const database = await openResearchDatabase();

    expect(await database.count(FACT_STORE)).toBe(CHUNK_COUNT);
    expect(await database.get(EXTRACTION_STORE, snapshotId)).toMatchObject({
      keptCount: CHUNK_COUNT,
      droppedCount: CHUNK_COUNT,
    });
  });

  it("drops a redone chunk's earlier facts when it now keeps fewer", async () => {
    await run();
    job = { ...job, checkpoint: undefined };
    await run({
      generate: () => answerWith(JSON.stringify({ entities: [], facts: [] })),
    });

    expect(await (await openResearchDatabase()).count(FACT_STORE)).toBe(0);
  });

  it("stops before the next chunk when it may not go on, and says it deferred", async () => {
    let asked = 0;
    const generate = vi.fn(honestAndInventive);

    expect(
      await run({
        generate,
        mayContinue: () => {
          asked += 1;
          return Promise.resolve(asked === 1);
        },
      }),
    ).toBe("deferred");
    expect(generate).toHaveBeenCalledTimes(1);
    await expect((await openResearchDatabase()).get(JOB_STORE, job.id)).resolves.toMatchObject({
      checkpoint: { nextChunk: 1 },
    });
  });

  it("records each request in the content-free run log", async () => {
    await run();

    const runs = await (await openResearchDatabase()).getAll(INFERENCE_RUN_STORE);

    expect(runs).toHaveLength(CHUNK_COUNT);
    expect(runs[0]).toMatchObject({ modelRef: "ollama:qwen3:4b@abc", itemCount: 1 });
  });

  it("fails when its snapshot is gone", async () => {
    job = { ...job, payload: { snapshotId: "missing" } };

    await expect(run()).rejects.toThrow("no longer exists");
  });
});
