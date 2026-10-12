import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { recordEdge } from ".";
import type { NewEdge } from "../../types";
import { EDGE_STORE, openResearchDatabase, type ResearchDatabaseSchema } from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(EDGE_STORE);
});

const opener: NewEdge = { sessionId: "session-1", kind: "opener", from: "a", to: "b", weight: 1 };

describe("recordEdge", () => {
  it("keys the relation by its ends and kind", async () => {
    const edge = await recordEdge(database, opener);

    expect(edge).toMatchObject({ id: "a|b|opener", ...opener });
    expect(await database.get(EDGE_STORE, "a|b|opener")).toEqual(edge);
  });

  it("stores a relation recorded twice once, leaving the first unchanged", async () => {
    const first = await recordEdge(database, opener);
    const second = await recordEdge(database, { ...opener, weight: 0.5 });

    expect(second).toEqual(first);
    expect(await database.count(EDGE_STORE)).toBe(1);
  });

  it("stores two kinds of relation between the same nodes as two edges", async () => {
    await recordEdge(database, opener);
    await recordEdge(database, { ...opener, kind: "coAttention" });

    expect(await database.count(EDGE_STORE)).toBe(2);
  });
});
