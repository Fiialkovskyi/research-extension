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
      provenance: { modelRef: "m", prompt: "p", chunkerVersion: "c", extractedAt: 1 },
      encryptedFact: sealed.ciphertext,
    } as never);
  }

  return database;
};

import { beforeEach, describe, expect, it } from "vitest";

import { enqueueOpenQuestions } from ".";
import { getFactSetHash } from "@/features/clusterSummaries";

beforeEach(seedSession);

describe("enqueueOpenQuestions", () => {
  it("queues questions a minute ahead, keyed by the session's fact set", async () => {
    const now = Date.now() + 1_000;
    const job = await enqueueOpenQuestions(await openResearchDatabase(), "s", now);

    expect(job).toMatchObject({
      type: "suggestQuestions",
      sessionId: "s",
      nextAttemptAt: now + 60_000,
      producerVersion: `openQuestions@1|${MODEL}`,
      payload: { factSetHash: await getFactSetHash(["a:0:0", "a:0:1"]) },
    });
  });

  it("queues nothing when the questions are current, or without a model", async () => {
    const database = await openResearchDatabase();

    await database.put(QUESTION_STORE, {
      sessionId: "s",
      factSetHash: await getFactSetHash(["a:0:0", "a:0:1"]),
      modelRef: "ollama:other@1",
    } as never);

    // Current facts, another model: kept (REQ-LIN-005).
    expect(await enqueueOpenQuestions(database, "s")).toBeUndefined();

    await database.clear(QUESTION_STORE);
    await database.clear(MODEL_STORE);

    expect(await enqueueOpenQuestions(database, "s")).toBeUndefined();
  });
});
