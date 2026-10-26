import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readClusterEntities } from ".";
import { encryptBytes, getDataKey } from "@/features/dataProtection";
import { ENTITY_STORE, FACT_STORE, openResearchDatabase } from "@/shared/storage";

const seal = async (value: unknown) =>
  encryptBytes(
    await getDataKey(await openResearchDatabase()),
    new TextEncoder().encode(JSON.stringify(value)),
  );

const putEntity = async (id: string, name: string, mergedInto?: string) => {
  const sealed = await seal({ name, type: "product" });

  await (
    await openResearchDatabase()
  ).put(ENTITY_STORE, {
    id,
    sessionId: "s",
    isSeparated: false,
    createdAt: 1,
    ...(mergedInto === undefined ? {} : { mergedInto }),
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedEntity: sealed.ciphertext,
  });
};

const putFact = async (id: string, nodeId: string, entityId: string) => {
  const sealed = await seal({ subject: "x", attribute: "a", value: id, quote: "q" });

  await (
    await openResearchDatabase()
  ).put(FACT_STORE, {
    id,
    nodeId,
    sessionId: "s",
    entityId,
    keyId: sealed.keyId,
    iv: sealed.iv,
    provenance: { modelRef: "m", prompt: "p", chunkerVersion: "c", extractedAt: 1 },
    encryptedFact: sealed.ciphertext,
  } as never);
};

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all([database.clear(ENTITY_STORE), database.clear(FACT_STORE)]);
});

describe("readClusterEntities", () => {
  it("reads each root entity with at least three facts, its name and the pages that state them", async () => {
    await putEntity("e1", "Pixel 10a");
    await putEntity("e2", "Pixel 10 a", "e1");
    await putEntity("e3", "Thin");
    await putFact("f1", "a", "e1");
    await putFact("f2", "a", "e2");
    await putFact("f3", "b", "e1");
    await putFact("f4", "a", "e3");

    expect(await readClusterEntities(await openResearchDatabase(), "s")).toEqual([
      {
        name: "Pixel 10a",
        factCount: 3,
        pages: [
          { nodeId: "a", factCount: 2 },
          { nodeId: "b", factCount: 1 },
        ],
      },
    ]);
  });

  it("reads nothing for a session without entities", async () => {
    expect(await readClusterEntities(await openResearchDatabase(), "s")).toEqual([]);
  });
});
