import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { reconcileActiveSession } from ".";
import {
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredSession,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(SESSION_STORE);
});

const active: StoredSession = {
  id: "session-1",
  title: "E-bike motors",
  groupId: 42,
  formerGroupIds: [],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
};

describe("reconcileActiveSession", () => {
  it("asks the browser nothing when no session is active", async () => {
    const getGroup = vi.fn();

    expect(await reconcileActiveSession({ database, getGroup })).toBeUndefined();
    expect(getGroup).not.toHaveBeenCalled();
  });

  it("keeps a session whose group is unchanged", async () => {
    await database.put(SESSION_STORE, active);
    const getGroup = vi.fn().mockResolvedValue({ color: "blue", title: "E-bike motors" });

    expect(await reconcileActiveSession({ database, getGroup })).toEqual(active);
    expect(getGroup).toHaveBeenCalledWith(42);
  });

  it("closes, rather than ends, a session whose group no longer exists", async () => {
    await database.put(SESSION_STORE, active);
    const getGroup = vi.fn().mockRejectedValue(new Error("No group with id: 42"));

    expect(await reconcileActiveSession({ database, getGroup })).toBeUndefined();
    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({ status: "closed" });
  });

  it("reopens a closed session whose group exists again", async () => {
    await database.put(SESSION_STORE, { ...active, status: "closed" });
    const getGroup = vi.fn().mockResolvedValue({ color: "blue", title: "E-bike motors" });

    expect(await reconcileActiveSession({ database, getGroup })).toMatchObject({
      status: "active",
    });
    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({ status: "active" });
  });

  it("leaves a closed session closed while its group is still missing", async () => {
    await database.put(SESSION_STORE, { ...active, status: "closed" });
    const getGroup = vi.fn().mockRejectedValue(new Error("No group with id: 42"));

    expect(await reconcileActiveSession({ database, getGroup })).toBeUndefined();
    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({ status: "closed" });
  });

  it("asks nothing about an ended session", async () => {
    await database.put(SESSION_STORE, { ...active, status: "saved" });
    const getGroup = vi.fn();

    expect(await reconcileActiveSession({ database, getGroup })).toBeUndefined();
    expect(getGroup).not.toHaveBeenCalled();
  });

  it("takes over a title the group gained while nothing was listening", async () => {
    await database.put(SESSION_STORE, active);
    const getGroup = vi.fn().mockResolvedValue({ color: "blue", title: "Mid-drive motors" });

    expect(await reconcileActiveSession({ database, getGroup })).toMatchObject({
      title: "Mid-drive motors",
    });
    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({
      title: "Mid-drive motors",
    });
  });
});
