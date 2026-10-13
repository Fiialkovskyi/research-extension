import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { runEntityResolutionJob } from ".";
import { encryptBytes, getDataKey } from "@/features/dataProtection";
import { ENTITY_STORE, FACT_STORE, openResearchDatabase, type StoredJob } from "@/shared/storage";

import { readSealedEntity } from "../readSealedEntity";

/** Stores a fact of `snapshotId` about `subject`, encrypted as extraction stores it. */
const storeFact = async (
  snapshotId: string,
  index: number,
  subject: string,
  entityType: string,
) => {
  const database = await openResearchDatabase();
  const dataKey = await getDataKey(database);
  const text = { subject, entityType, attribute: "weight", value: "1", quote: "q" };
  const sealed = await encryptBytes(dataKey, new TextEncoder().encode(JSON.stringify(text)));

  await database.put(FACT_STORE, {
    id: `${snapshotId}:0:${index}`,
    sessionId: "session-1",
    nodeId: `node-${snapshotId}`,
    snapshotId,
    chunkId: `${snapshotId}:0`,
    provenance: { modelRef: "m", prompt: "factExtraction@1", chunkerVersion: "c", extractedAt: 1 },
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedFact: sealed.ciphertext,
  });
};

const jobFor = (snapshotId: string): StoredJob => ({
  id: `job-${snapshotId}`,
  type: "resolveEntities",
  inputHashes: [snapshotId],
  producerVersion: "entityName@1|none",
  status: "running",
  priority: 0,
  attempts: 0,
  nextAttemptAt: 0,
  createdAt: 0,
  updatedAt: 0,
  payload: { snapshotId },
});

/** Embeds a name as a direction: names sharing "neo" point the same way. */
const embedByWord = vi.fn((texts: readonly string[]) =>
  Promise.resolve(
    texts.map((text) =>
      /neo/iu.test(text) ? new Float32Array([1, 0.1]) : new Float32Array([0, 1]),
    ),
  ),
);

const readEntities = async () => {
  const database = await openResearchDatabase();
  const dataKey = await getDataKey(database);

  return Promise.all(
    (await database.getAll(ENTITY_STORE)).map(async (entity) => ({
      ...entity,
      ...(await readSealedEntity(dataKey, entity)),
    })),
  );
};

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all([database.clear(FACT_STORE), database.clear(ENTITY_STORE)]);
  embedByWord.mockClear();
});

describe("runEntityResolutionJob", () => {
  it("makes an entity per subject, encrypted, and links each fact to it", async () => {
    await storeFact("a", 0, "Volta E5", "product");
    await storeFact("a", 1, "Volta E5", "product");
    await storeFact("a", 2, "Telemart", "company");

    expect(
      await runEntityResolutionJob({ database: await openResearchDatabase(), job: jobFor("a") }),
    ).toBe(3);

    const database = await openResearchDatabase();
    const entities = await readEntities();
    const facts = await database.getAll(FACT_STORE);

    expect(entities.map(({ name, type }) => `${name}/${type}`).toSorted()).toEqual([
      "Telemart/company",
      "Volta E5/product",
    ]);
    expect(JSON.stringify(await database.getAll(ENTITY_STORE))).not.toContain("Volta");
    expect(new Set(facts.slice(0, 2).map(({ entityId }) => entityId)).size).toBe(1);
  });

  it("joins a second page's subject to the first page's entity by name", async () => {
    await storeFact("a", 0, 'MacBook Neo 13"', "product");
    await runEntityResolutionJob({ database: await openResearchDatabase(), job: jobFor("a") });
    await storeFact("b", 0, "macbook neo 13", "product");
    await runEntityResolutionJob({ database: await openResearchDatabase(), job: jobFor("b") });

    const facts = await (await openResearchDatabase()).getAll(FACT_STORE);

    expect(await readEntities()).toHaveLength(1);
    expect(facts[0]?.entityId).toBe(facts[1]?.entityId);
  });

  it("records a match by meaning as an entity merged into the match", async () => {
    await storeFact("a", 0, "Apple MacBook Neo 13 A18 Pro", "product");
    await storeFact("a", 1, "Telemart", "company");
    await runEntityResolutionJob({
      database: await openResearchDatabase(),
      job: jobFor("a"),
      embed: embedByWord,
    });
    await storeFact("b", 0, "Neo laptop", "product");
    await runEntityResolutionJob({
      database: await openResearchDatabase(),
      job: jobFor("b"),
      embed: embedByWord,
    });

    const entities = await readEntities();
    const root = entities.find(({ name }) => name.startsWith("Apple"));

    expect(entities.find(({ name }) => name === "Neo laptop")?.mergedInto).toBe(root?.id);
    expect(root?.mergedInto).toBeUndefined();
  });

  it("only names are matched without an embedding model", async () => {
    await storeFact("a", 0, "Apple MacBook Neo 13", "product");
    await storeFact("a", 1, "Neo laptop", "product");
    await runEntityResolutionJob({ database: await openResearchDatabase(), job: jobFor("a") });

    expect((await readEntities()).every(({ mergedInto }) => mergedInto === undefined)).toBe(true);
    expect(await readEntities()).toHaveLength(2);
  });

  it("leaves facts that already have an entity alone on a rerun", async () => {
    await storeFact("a", 0, "Volta E5", "product");
    await runEntityResolutionJob({ database: await openResearchDatabase(), job: jobFor("a") });

    expect(
      await runEntityResolutionJob({ database: await openResearchDatabase(), job: jobFor("a") }),
    ).toBe(0);
    expect(await readEntities()).toHaveLength(1);
  });

  it("gives an entity first seen untyped the first known type", async () => {
    await storeFact("a", 0, "Volta E5", "unknown");
    await runEntityResolutionJob({ database: await openResearchDatabase(), job: jobFor("a") });
    await storeFact("b", 0, "Volta E5", "product");
    await runEntityResolutionJob({ database: await openResearchDatabase(), job: jobFor("b") });

    expect((await readEntities()).map(({ type }) => type)).toEqual(["product"]);
  });
});
