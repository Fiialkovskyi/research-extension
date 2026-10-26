import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { reclusterActiveSession } from ".";
import { readClustering } from "../readClustering";
import { encryptBytes, getDataKey } from "@/features/dataProtection";
import {
  CLUSTERING_STORE,
  ENTITY_STORE,
  FACT_STORE,
  EDGE_STORE,
  VECTOR_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredNode,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const page = (id: string, createdAt: number): StoredNode => ({
  id,
  sessionId: "session-1",
  tabId: 1,
  kind: "page",
  url: `https://example.org/${id}`,
  domain: "example.org",
  title: `Page ${id}`,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  signals: {
    activeDwellMs: 20_000,
    maxScroll: 0.5,
    copyEvents: 0,
    pasteEvents: 0,
    focusCount: 1,
    revisitCount: 0,
    quickReturnCount: 0,
  },
  tabState: "open",
  createdAt,
});

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all([
    database.clear(SESSION_STORE),
    database.clear(NODE_STORE),
    database.clear(EDGE_STORE),
    database.clear(CLUSTERING_STORE),
    database.clear(VECTOR_STORE),
    database.clear(ENTITY_STORE),
    database.clear(FACT_STORE),
  ]);
  await database.put(SESSION_STORE, {
    id: "session-1",
    title: "E-bike motors",
    groupId: 42,
    formerGroupIds: [],
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });
  await database.put(NODE_STORE, page("a", 1));
  await database.put(NODE_STORE, page("b", 2));
  await database.put(EDGE_STORE, {
    id: "a|b|opener",
    sessionId: "session-1",
    kind: "opener",
    from: "a",
    to: "b",
    weight: 1,
    createdAt: 2,
  });
});

describe("reclusterActiveSession", () => {
  it("clusters the active session's graph and stores the result", async () => {
    const clustering = await reclusterActiveSession(database, "session-1", 50);

    expect(clustering?.clusters.map(({ memberIds }) => memberIds)).toEqual([["a", "b"]]);
    expect(await readClustering(database, "session-1")).toEqual(clustering);
  });

  it("keeps the cluster's id from the last run", async () => {
    const first = await reclusterActiveSession(database, "session-1", 50);

    await database.put(NODE_STORE, { ...page("c", 3), parentNodeId: "b" });
    await database.put(EDGE_STORE, {
      id: "b|c|sameTab",
      sessionId: "session-1",
      kind: "sameTab",
      from: "b",
      to: "c",
      weight: 0.5,
      createdAt: 3,
    });

    const again = await reclusterActiveSession(database, "session-1", 60);

    expect(again?.clusters[0]?.id).toBe(first?.clusters[0]?.id);
    expect(again?.clusters[0]?.memberIds).toEqual(["a", "b", "c"]);
  });

  it("does nothing without an active session", async () => {
    await database.clear(SESSION_STORE);

    expect(await reclusterActiveSession(database, "session-1")).toBeUndefined();
    expect(await database.count(CLUSTERING_STORE)).toBe(0);
  });

  it("adds semantic edges from the session's space, and records it", async () => {
    await database.put(NODE_STORE, page("lone", 3));
    await database.put(SESSION_STORE, {
      ...(await database.get(SESSION_STORE, "session-1"))!,
      activeEmbeddingSpaceId: "space-1",
    });
    await Promise.all(
      ["b", "lone"].map((nodeId) =>
        database.put(VECTOR_STORE, {
          spaceId: "space-1",
          chunkId: `${nodeId}:0`,
          part: 0,
          nodeId,
          sessionId: "session-1",
          vector: new Float32Array([1, 0, 0]),
        }),
      ),
    );

    const clustering = await reclusterActiveSession(database, "session-1", 70);

    expect(clustering?.embeddingSpaceId).toBe("space-1");
    expect(clustering?.clusters.map(({ memberIds }) => memberIds.toSorted())).toEqual([
      ["a", "b", "lone"],
    ]);
  });

  it("links pages that state facts about one entity, and names their cluster after it", async () => {
    await database.put(NODE_STORE, page("lone", 3));

    const sealEntity = await encryptBytes(
      await getDataKey(database),
      new TextEncoder().encode(JSON.stringify({ name: "Pixel 10a", type: "product" })),
    );

    await database.put(ENTITY_STORE, {
      id: "e1",
      sessionId: "session-1",
      isSeparated: false,
      createdAt: 1,
      keyId: sealEntity.keyId,
      iv: sealEntity.iv,
      encryptedEntity: sealEntity.ciphertext,
    });

    for (const [id, nodeId] of [
      ["f1", "b"],
      ["f2", "b"],
      ["f3", "lone"],
    ]) {
      const sealed = await encryptBytes(
        await getDataKey(database),
        new TextEncoder().encode(
          JSON.stringify({ subject: "x", attribute: "a", value: id, quote: "q" }),
        ),
      );

      await database.put(FACT_STORE, {
        id,
        nodeId,
        sessionId: "session-1",
        entityId: "e1",
        keyId: sealed.keyId,
        iv: sealed.iv,
        provenance: { modelRef: "m", prompt: "p", chunkerVersion: "c", extractedAt: 1 },
        encryptedFact: sealed.ciphertext,
      } as never);
    }

    const clustering = await reclusterActiveSession(database, "session-1", 80);

    expect(clustering?.clusters.map(({ memberIds }) => memberIds.toSorted())).toEqual([
      ["a", "b", "lone"],
    ]);
    expect(clustering?.clusters[0]?.label).toBe("Pixel 10a");
  });
});
