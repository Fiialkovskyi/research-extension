import "fake-indexeddb/auto";

import { encryptBytes, getDataKey } from "@/features/dataProtection";
import {
  FACT_STORE,
  JOB_STORE,
  MODEL_STORE,
  NODE_STORE,
  openResearchDatabase,
  QUESTION_STORE,
  REJECTION_STORE,
  SESSION_STORE,
} from "@/shared/storage";

const MODEL = "ollama:qwen3:4b@abc";

/** A session with one page holding two facts, and an active generation model. */
const seedSession = async () => {
  const database = await openResearchDatabase();

  await Promise.all(
    (
      [
        FACT_STORE,
        JOB_STORE,
        MODEL_STORE,
        NODE_STORE,
        QUESTION_STORE,
        REJECTION_STORE,
        SESSION_STORE,
      ] as const
    ).map((store) => database.clear(store)),
  );
  await database.put(SESSION_STORE, {
    id: "s",
    title: "E-bikes",
    groupId: 1,
    formerGroupIds: [],
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });
  await database.put(MODEL_STORE, {
    ref: MODEL,
    manifest: {
      reference: { repository: "qwen3:4b" },
      contract: { family: "text-generation" },
    },
    active: true,
    conformance: "passed",
    installedAt: 1,
  } as never);
  await database.put(NODE_STORE, {
    id: "a",
    sessionId: "s",
    url: "https://a",
    title: "A",
  } as never);

  for (const [id, value] of [
    ["a:0:0", "23.5"],
    ["a:0:1", "1749"],
  ] as const) {
    const sealed = await encryptBytes(
      await getDataKey(database),
      new TextEncoder().encode(
        JSON.stringify({ subject: "Volta", attribute: "x", value, quote: "q" }),
      ),
    );

    await database.put(FACT_STORE, {
      id,
      sessionId: "s",
      nodeId: "a",
      keyId: sealed.keyId,
      iv: sealed.iv,
      encryptedFact: sealed.ciphertext,
    } as never);
  }

  return database;
};

import { beforeEach, describe, expect, it, vi } from "vitest";

import { runOpenQuestionsJob } from ".";
import { getFactSetHash } from "@/features/clusterSummaries";
import type { GenerateRequest, GenerationStream } from "@/features/inference";
import type { StoredJob } from "@/shared/storage";

const answerWith = (text: string): GenerationStream => ({
  final: () => Promise.resolve({ text, device: "local-server", stoppedBecause: "model" }),
  async *[Symbol.asyncIterator]() {
    yield { delta: text };
  },
});

const job = async (): Promise<StoredJob> =>
  ({
    id: "j",
    type: "suggestQuestions",
    sessionId: "s",
    payload: { factSetHash: await getFactSetHash(["a:0:0", "a:0:1"]) },
  }) as StoredJob;

beforeEach(seedSession);

describe("runOpenQuestionsJob", () => {
  it("asks once with the questions prompt and stores the questions encrypted", async () => {
    const generate = vi.fn((_request: GenerateRequest) =>
      answerWith(
        JSON.stringify({
          questions: [{ question: "Is the battery removable?", query: "volta battery removable" }],
        }),
      ),
    );

    expect(
      await runOpenQuestionsJob({
        database: await openResearchDatabase(),
        job: await job(),
        modelRef: MODEL,
        generate,
      }),
    ).toBe(true);

    const stored = await (await openResearchDatabase()).get(QUESTION_STORE, "s");

    expect(generate.mock.calls[0]?.[0]).toMatchObject({ maxTokens: 512, contextTokens: 8_192 });
    expect(generate.mock.calls[0]?.[0].messages[0]?.content).toMatch(/at most 5/u);
    expect(stored).toMatchObject({ modelRef: MODEL, prompt: "openQuestions@1" });
    expect(JSON.stringify(stored)).not.toContain("battery");
  });

  it("does nothing once the session's facts changed", async () => {
    const database = await openResearchDatabase();
    const generate = vi.fn();
    const stale = await job();

    await database.delete(FACT_STORE, "a:0:1");

    expect(await runOpenQuestionsJob({ database, job: stale, modelRef: MODEL, generate })).toBe(
      false,
    );
    expect(generate).not.toHaveBeenCalled();
  });

  it("fails on an answer outside the schema", async () => {
    await expect(
      runOpenQuestionsJob({
        database: await openResearchDatabase(),
        job: await job(),
        modelRef: MODEL,
        generate: () => answerWith("Some questions"),
      }),
    ).rejects.toThrow("not JSON");
  });
});
