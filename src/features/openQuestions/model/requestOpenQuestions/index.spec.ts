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
    manifest: { contract: { family: "text-generation" } },
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

import { beforeEach, describe, expect, it } from "vitest";

import { requestOpenQuestions } from ".";

import { enqueueOpenQuestions } from "../enqueueOpenQuestions";

beforeEach(seedSession);

describe("requestOpenQuestions", () => {
  it("marks the debounced job as asked for and due now", async () => {
    const database = await openResearchDatabase();
    const job = await enqueueOpenQuestions(database, Date.now());

    expect(await requestOpenQuestions(database, 7)).toBe(true);
    expect(await database.get(JOB_STORE, job!.id)).toMatchObject({
      nextAttemptAt: 7,
      payload: { requestedAt: 7 },
    });
  });

  it("queues nothing for a session without facts", async () => {
    const database = await openResearchDatabase();

    await database.clear(FACT_STORE);

    expect(await requestOpenQuestions(database)).toBe(false);
  });
});
