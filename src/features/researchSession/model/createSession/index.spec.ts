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

  it("records a second session beside the first", async () => {
    await createSession({ database, title: "E-bike motors", groupId: 42 });

    await createSession({ database, title: "Batteries", groupId: 43 });

    expect(await database.countFromIndex(SESSION_STORE, "status", "active")).toBe(2);
  });

  it("lets two simultaneous starts for different groups both through", async () => {
    const outcomes = await Promise.allSettled([
      createSession({ database, title: "First", groupId: 1 }),
      createSession({ database, title: "Second", groupId: 2 }),
    ]);

    expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
    expect(await database.countFromIndex(SESSION_STORE, "status", "active")).toBe(2);
  });

  it("refuses a group that already belongs to a live session", async () => {
    await createSession({ database, title: "E-bike motors", groupId: 42 });

    await expect(createSession({ database, title: "Again", groupId: 42 })).rejects.toThrow(
      "That tab group already belongs to a session.",
    );
    expect(await database.count(SESSION_STORE)).toBe(1);
  });

  it("refuses a group a live session followed before", async () => {
    const first = await createSession({ database, title: "E-bike motors", groupId: 42 });
    await database.put(SESSION_STORE, { ...first, groupId: 50, formerGroupIds: [42] });

    await expect(createSession({ database, title: "Again", groupId: 42 })).rejects.toThrow(
      "That tab group already belongs to a session.",
    );
  });

  it("leaves a closed session closed", async () => {
    const first = await createSession({ database, title: "E-bike motors", groupId: 42 });
    await database.put(SESSION_STORE, { ...first, status: "closed" });

    const second = await createSession({ database, title: "Batteries", groupId: 43 });

    expect(second).toMatchObject({ status: "active", formerGroupIds: [] });
    expect(await database.get(SESSION_STORE, first.id)).toMatchObject({ status: "closed" });
  });

  it("starts beside a saved session", async () => {
    const first = await createSession({ database, title: "E-bike motors", groupId: 42 });
    await database.put(SESSION_STORE, { ...first, status: "saved" });

    await expect(
      createSession({ database, title: "Batteries", groupId: 43 }),
    ).resolves.toMatchObject({ title: "Batteries", status: "active" });
  });
});
