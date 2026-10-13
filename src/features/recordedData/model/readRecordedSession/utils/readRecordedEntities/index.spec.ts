import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readRecordedEntities } from ".";
import { encryptBytes, getDataKey } from "@/features/dataProtection";
import { ENTITY_STORE, FACT_STORE, openResearchDatabase } from "@/shared/storage";

const storeEntity = async (id: string, name: string, mergedInto?: string) => {
  const database = await openResearchDatabase();
  const dataKey = await getDataKey(database);
  const sealed = await encryptBytes(
    dataKey,
    new TextEncoder().encode(JSON.stringify({ name, type: "product" })),
  );

  await database.put(ENTITY_STORE, {
    id,
    sessionId: "session-1",
    isSeparated: false,
    ...(mergedInto === undefined ? {} : { mergedInto }),
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedEntity: sealed.ciphertext,
    createdAt: 1,
  });
};

const storeFact = (id: string, nodeId: string, entityId: string) =>
  openResearchDatabase().then((database) =>
    database.put(FACT_STORE, { id, nodeId, sessionId: "session-1", entityId } as never),
  );

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all([database.clear(ENTITY_STORE), database.clear(FACT_STORE)]);
});

describe("readRecordedEntities", () => {
  it("lists root entities with the facts and pages they and their merged ones hold", async () => {
    await storeEntity("neo", "MacBook Neo 13");
    await storeEntity("apple-neo", "Apple MacBook Neo 13 A18 Pro", "neo");
    await storeEntity("shop", "Telemart");
    await storeFact("a:0:0", "page-a", "neo");
    await storeFact("a:0:1", "page-a", "shop");
    await storeFact("b:0:0", "page-b", "apple-neo");

    expect(await readRecordedEntities(await openResearchDatabase(), "session-1")).toEqual([
      {
        id: "neo",
        name: "MacBook Neo 13",
        type: "product",
        factCount: 2,
        pageCount: 2,
        merged: [{ id: "apple-neo", name: "Apple MacBook Neo 13 A18 Pro" }],
      },
      { id: "shop", name: "Telemart", type: "product", factCount: 1, pageCount: 1, merged: [] },
    ]);
  });

  it("lists nothing for a session without entities", async () => {
    expect(await readRecordedEntities(await openResearchDatabase(), "session-1")).toEqual([]);
  });
});
