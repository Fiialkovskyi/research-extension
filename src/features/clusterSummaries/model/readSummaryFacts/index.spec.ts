import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readSummaryFacts } from ".";
import { encryptBytes, getDataKey } from "@/features/dataProtection";
import { ENTITY_STORE, FACT_STORE, openResearchDatabase } from "@/shared/storage";

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
});
