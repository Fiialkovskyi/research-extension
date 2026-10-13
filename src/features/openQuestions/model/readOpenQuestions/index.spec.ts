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

import { readOpenQuestions } from ".";
import { getFactSetHash } from "@/features/clusterSummaries";

const storeQuestions = async (factSetHash: string, modelRef = MODEL) => {
  const database = await openResearchDatabase();
  const sealed = await encryptBytes(
    await getDataKey(database),
    new TextEncoder().encode(JSON.stringify([{ question: "Warranty?", query: "volta warranty" }])),
  );

  await database.put(QUESTION_STORE, {
    sessionId: "s",
    factSetHash,
    modelRef,
    prompt: "openQuestions@1",
    generatedAt: 1,
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedQuestions: sealed.ciphertext,
  });
};

beforeEach(seedSession);

describe("readOpenQuestions", () => {
  it("shows the session's questions, fresh", async () => {
    await storeQuestions(await getFactSetHash(["a:0:0", "a:0:1"]));

    expect(await readOpenQuestions(await openResearchDatabase())).toEqual({
      questions: [{ question: "Warranty?", query: "volta warranty" }],
      hasQuestions: true,
      isStale: false,
      isPending: false,
      canSuggest: true,
    });
  });

  it("says they are stale once the facts or the model changed", async () => {
    await storeQuestions("old");
    expect((await readOpenQuestions(await openResearchDatabase()))?.isStale).toBe(true);

    await storeQuestions(await getFactSetHash(["a:0:0", "a:0:1"]), "removed@1");
    expect((await readOpenQuestions(await openResearchDatabase()))?.isStale).toBe(true);
  });

  it("shows a requested set as pending, and none yet", async () => {
    await (
      await openResearchDatabase()
    ).put(JOB_STORE, {
      id: "j",
      type: "suggestQuestions",
      sessionId: "s",
      status: "queued",
      payload: { factSetHash: "h", requestedAt: 1 },
    } as never);

    expect(await readOpenQuestions(await openResearchDatabase())).toMatchObject({
      questions: [],
      hasQuestions: false,
      isPending: true,
    });
  });
});
