import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { findReattachCandidate } from ".";
import {
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredSession,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const session = (id: string, status: StoredSession["status"]): StoredSession => ({
  id,
  title: `Session ${id}`,
  groupId: 1,
  formerGroupIds: [],
  status,
  createdAt: 1,
  updatedAt: 1,
});

/** A session whose first search is `query`. */
const withRoot = async (id: string, status: StoredSession["status"], query: string) => {
  await database.put(SESSION_STORE, session(id, status));
  await database.put(NODE_STORE, {
    id: `${id}-root`,
    sessionId: id,
    kind: "serp",
    query,
    createdAt: 1,
  } as never);
};

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all([database.clear(SESSION_STORE), database.clear(NODE_STORE)]);
  await withRoot("new", "active", "e-bike mid-drive motors");
});

/** A model stub: "e-bike motors" points one way, every other query the other. */
const embedQueries = (queries: readonly string[]) =>
  Promise.resolve(
    queries.map((query) =>
      query === "e-bike motors" ? new Float32Array([0, 1]) : new Float32Array([1, 0]),
    ),
  );

describe("findReattachCandidate", () => {
  it("offers a saved session whose first search shares most terms", async () => {
    await withRoot("motors", "saved", "e-bike motors");

    expect(await findReattachCandidate({ database, sessionId: "new" })).toEqual({
      sessionId: "motors",
      title: "Session motors",
      reason: "terms",
      score: 2 / 3,
    });
  });

  it("offers nothing for an unrelated search", async () => {
    await withRoot("bread", "saved", "sourdough starter");

    expect(await findReattachCandidate({ database, sessionId: "new" })).toBeUndefined();
  });

  it("offers a session that means the same, with a model, and prefers meaning", async () => {
    await withRoot("motors", "saved", "e-bike motors");
    await withRoot("drives", "saved", "electric bicycle drive units");

    expect(await findReattachCandidate({ database, sessionId: "new", embedQueries })).toMatchObject(
      {
        sessionId: "drives",
        reason: "meaning",
      },
    );
  });

  it("keeps the best of two term matches", async () => {
    await withRoot("motors", "saved", "e-bike motors");
    await withRoot("exact", "saved", "mid-drive e-bike motors");

    expect(await findReattachCandidate({ database, sessionId: "new" })).toMatchObject({
      sessionId: "exact",
      score: 1,
    });
  });

  it("ignores sessions that are not saved, and a session without a search", async () => {
    await withRoot("live", "closed", "e-bike motors");

    expect(await findReattachCandidate({ database, sessionId: "new" })).toBeUndefined();

    await database.clear(NODE_STORE);

    expect(await findReattachCandidate({ database, sessionId: "new" })).toBeUndefined();
  });
});
