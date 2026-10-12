import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { storeClustering } from ".";
import { readClustering } from "../readClustering";
import { CLUSTERING_STORE, openResearchDatabase } from "@/shared/storage";

const clustering = (memberIds: string[]) => ({
  sessionId: "session-1",
  algorithmVersion: "louvain@1",
  configVersion: "cluster_config@1",
  computedAt: 1,
  clusters: [{ id: "k", label: "motors", memberIds }],
});

beforeEach(async () => {
  const database = await openResearchDatabase();

  await database.clear(CLUSTERING_STORE);
});

describe("storeClustering and readClustering", () => {
  it("reads back what was stored for the session, and nothing for another", async () => {
    const database = await openResearchDatabase();

    await storeClustering(database, clustering(["a", "b"]));

    expect(await readClustering(database, "session-1")).toEqual(clustering(["a", "b"]));
    expect(await readClustering(database, "session-2")).toBeUndefined();
  });

  it("replaces the previous clustering whole", async () => {
    const database = await openResearchDatabase();

    await storeClustering(database, clustering(["a", "b"]));
    await storeClustering(database, clustering(["c"]));

    expect(await database.getAll(CLUSTERING_STORE)).toEqual([clustering(["c"])]);
  });
});
