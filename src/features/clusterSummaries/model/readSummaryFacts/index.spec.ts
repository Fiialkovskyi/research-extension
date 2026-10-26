import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readSummaryFacts } from ".";
import { encryptBytes, getDataKey } from "@/features/dataProtection";
import { ENTITY_STORE, FACT_STORE, openResearchDatabase } from "@/shared/storage";

const sealEntity = async (name: string) => {
  const sealed = await encryptBytes(
    await getDataKey(await openResearchDatabase()),
    new TextEncoder().encode(JSON.stringify({ name, type: "product" })),
  );

  return { keyId: sealed.keyId, iv: sealed.iv, encryptedEntity: sealed.ciphertext };
};

const storeFact = async (id: string, subject: string, entityId?: string) => {
  const database = await openResearchDatabase();
  const sealed = await encryptBytes(
    await getDataKey(database),
    new TextEncoder().encode(
      JSON.stringify({ subject, attribute: "weight", value: "1", unit: "kg", quote: "q" }),
    ),
  );

  await database.put(FACT_STORE, {
    id,
    sessionId: "s",
    nodeId: "n",
    ...(entityId === undefined ? {} : { entityId }),
    keyId: sealed.keyId,
    iv: sealed.iv,
    provenance: { modelRef: "m", prompt: "p", chunkerVersion: "c", extractedAt: 1 },
    encryptedFact: sealed.ciphertext,
  } as never);
};

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all([database.clear(FACT_STORE), database.clear(ENTITY_STORE)]);
  await database.put(ENTITY_STORE, { id: "root", sessionId: "s", isSeparated: false } as never);
  await database.put(ENTITY_STORE, {
    id: "child",
    sessionId: "s",
    mergedInto: "root",
    isSeparated: false,
  } as never);
  await storeFact("a", "Neo", "child");
  await storeFact("b", "Air");
});

describe("readSummaryFacts", () => {
  it("decrypts facts, grouping each under its root entity, or its subject without one", async () => {
    const database = await openResearchDatabase();
    const facts = await readSummaryFacts(database, await getDataKey(database), ["a", "b", "gone"]);

    expect(facts.map(({ id, groupKey, unit }) => [id, groupKey, unit])).toEqual([
      ["a", "root", "kg"],
      ["b", "subject:Air", "kg"],
    ]);
  });

  it("names each fact by its root entity, and by its subject when the entity cannot be read", async () => {
    const database = await openResearchDatabase();

    await database.put(ENTITY_STORE, {
      id: "root",
      sessionId: "s",
      isSeparated: false,
      createdAt: 1,
      ...(await sealEntity("iPhone 17")),
    });

    const facts = await readSummaryFacts(database, await getDataKey(database), ["a", "b"]);

    expect(facts.map(({ id, entityName, entityType }) => [id, entityName, entityType])).toEqual([
      ["a", "iPhone 17", "product"],
      ["b", "Air", "unknown"],
    ]);
  });

  it("falls back to the subject when the root entity's text does not decrypt", async () => {
    const database = await openResearchDatabase();
    const facts = await readSummaryFacts(database, await getDataKey(database), ["a"]);

    expect(facts[0]?.entityName).toBe("Neo");
  });
});
