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

import { beforeEach, describe, expect, it } from "vitest";

import { readSessionFactIds } from ".";
import { rejectFacts } from "@/features/factRejections";

beforeEach(seedSession);

describe("readSessionFactIds", () => {
  it("reads the facts of every page of the session, without rejected ones", async () => {
    const database = await openResearchDatabase();

    expect((await readSessionFactIds(database, "s")).toSorted()).toEqual(["a:0:0", "a:0:1"]);

    await rejectFacts(database, ["a:0:0"]);

    expect(await readSessionFactIds(database, "s")).toEqual(["a:0:1"]);
  });
});
