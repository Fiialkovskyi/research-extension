import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { separateEntity } from ".";
import { encryptBytes, getDataKey } from "@/features/dataProtection";
import { ENTITY_STORE, FACT_STORE, openResearchDatabase, type StoredJob } from "@/shared/storage";

import { runEntityResolutionJob } from "../runEntityResolutionJob";

/** A resolution job for one page. */
const job = (snapshotId: string) =>
  ({ id: snapshotId, type: "resolveEntities", payload: { snapshotId } }) as StoredJob;

/** A model to which every name looks alike. */
const embed = (texts: readonly string[]) =>
  Promise.resolve(texts.map(() => new Float32Array([1, 0])));

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all([database.clear(ENTITY_STORE), database.clear(FACT_STORE)]);
});

describe("separateEntity", () => {
  it("undoes the merge and marks the entity separated", async () => {
    const database = await openResearchDatabase();

    await database.put(ENTITY_STORE, {
      id: "neo",
      sessionId: "s",
      mergedInto: "air",
      isSeparated: false,
      keyId: "k",
      iv: new Uint8Array(12),
      encryptedEntity: new ArrayBuffer(1),
      createdAt: 1,
    });

    expect(await separateEntity(database, "neo")).toBe(true);
    expect(await database.get(ENTITY_STORE, "neo")).not.toHaveProperty("mergedInto");
    expect((await database.get(ENTITY_STORE, "neo"))?.isSeparated).toBe(true);
  });

  it("reports an entity that does not exist", async () => {
    expect(await separateEntity(await openResearchDatabase(), "missing")).toBe(false);
  });

  it("is not merged again by a later page", async () => {
    const database = await openResearchDatabase();
    const dataKey = await getDataKey(database);
    const store = async (snapshotId: string, subject: string) => {
      const text = { subject, entityType: "product", attribute: "a", value: "1", quote: "q" };
      const sealed = await encryptBytes(dataKey, new TextEncoder().encode(JSON.stringify(text)));

      await database.put(FACT_STORE, {
        id: `${snapshotId}:0:0`,
        sessionId: "s",
        nodeId: "n",
        snapshotId,
        chunkId: `${snapshotId}:0`,
        provenance: { modelRef: "m", prompt: "p", chunkerVersion: "c", extractedAt: 1 },
        keyId: sealed.keyId,
        iv: sealed.iv,
        encryptedFact: sealed.ciphertext,
      });
    };

    await store("a", "MacBook Air 13");
    await runEntityResolutionJob({ database, job: job("a"), embed });
    await store("b", "MacBook Neo 13");
    await runEntityResolutionJob({ database, job: job("b"), embed });

    const neo = (await database.getAll(ENTITY_STORE)).find(({ mergedInto }) => mergedInto);

    await separateEntity(database, neo!.id);
    await store("c", "MacBook Neo 13");
    await runEntityResolutionJob({ database, job: job("c"), embed });

    const entities = await database.getAll(ENTITY_STORE);

    expect(entities).toHaveLength(2);
    expect(entities.every(({ mergedInto }) => mergedInto === undefined)).toBe(true);
    expect((await database.get(FACT_STORE, "c:0:0"))?.entityId).toBe(neo!.id);
  });
});
