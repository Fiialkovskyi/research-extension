import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { createSession } from ".";
import { openResearchDatabase, type ResearchDatabaseSchema, SESSION_STORE } from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(SESSION_STORE);
});

describe("createSession", () => {
  it("records an active session for the group", async () => {
    const session = await createSession({ database, title: "E-bike motors", groupId: 42 });

    expect(session).toMatchObject({ title: "E-bike motors", groupId: 42, status: "active" });
    expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await database.get(SESSION_STORE, session.id)).toEqual(session);
  });

  it("refuses a second active session and names the first", async () => {
    await createSession({ database, title: "E-bike motors", groupId: 42 });

    await expect(createSession({ database, title: "Batteries", groupId: 43 })).rejects.toThrow(
      'A session is already active: "E-bike motors".',
    );
    expect(await database.count(SESSION_STORE)).toBe(1);
  });

  it("lets exactly one of two simultaneous starts through", async () => {
    const outcomes = await Promise.allSettled([
      createSession({ database, title: "First", groupId: 1 }),
      createSession({ database, title: "Second", groupId: 2 }),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(await database.countFromIndex(SESSION_STORE, "status", "active")).toBe(1);
  });

  it("starts a new session once the previous one is saved", async () => {
    const first = await createSession({ database, title: "E-bike motors", groupId: 42 });
    await database.put(SESSION_STORE, { ...first, status: "saved" });

    await expect(
      createSession({ database, title: "Batteries", groupId: 43 }),
    ).resolves.toMatchObject({ title: "Batteries", status: "active" });
  });
});
