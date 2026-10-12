import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { linkCoAttention } from ".";
import { EDGE_STORE, openResearchDatabase, type ResearchDatabaseSchema } from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(EDGE_STORE);
});

const move = (from: string, to: string, at = 0) => ({ from, to, at });

describe("linkCoAttention", () => {
  it("links a pair after three moves between them, in either direction", async () => {
    expect(
      await linkCoAttention(database, "session-1", [
        move("b", "a"),
        move("a", "b"),
        move("b", "a"),
      ]),
    ).toBe(true);
    expect(await database.getAll(EDGE_STORE)).toEqual([
      expect.objectContaining({
        id: "a|b|coAttention",
        from: "a",
        to: "b",
        kind: "coAttention",
        weight: 0.8,
        sessionId: "session-1",
      }),
    ]);
  });

  it("does not link after two moves", async () => {
    expect(await linkCoAttention(database, "session-1", [move("a", "b"), move("b", "a")])).toBe(
      false,
    );
    expect(await database.count(EDGE_STORE)).toBe(0);
  });

  it("counts only the latest move's pair", async () => {
    expect(
      await linkCoAttention(database, "session-1", [
        move("a", "c"),
        move("c", "b"),
        move("b", "a"),
        move("a", "b"),
      ]),
    ).toBe(false);
  });

  it("records the pair once, however often it is linked", async () => {
    const moves = [move("a", "b"), move("b", "a"), move("a", "b")];

    await linkCoAttention(database, "session-1", moves);
    await linkCoAttention(database, "session-1", [...moves, move("b", "a")]);

    expect(await database.count(EDGE_STORE)).toBe(1);
  });

  it("links nothing without moves", async () => {
    expect(await linkCoAttention(database, "session-1", [])).toBe(false);
  });
});
