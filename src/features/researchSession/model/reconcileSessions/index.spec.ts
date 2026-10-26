import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { reconcileSessions } from ".";
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

const session = (overrides: Partial<StoredSession>): StoredSession => ({
  id: "session-1",
  title: "E-bike motors",
  groupId: 42,
  formerGroupIds: [],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe("reconcileSessions", () => {
  it("asks the browser nothing when no session is live", async () => {
    const getGroup = vi.fn();

    expect(await reconcileSessions({ database, getGroup })).toEqual([]);
    expect(getGroup).not.toHaveBeenCalled();
  });

  it("keeps a session whose group is unchanged", async () => {
    await database.put(SESSION_STORE, session({}));
    const getGroup = vi.fn().mockResolvedValue({ color: "blue", title: "E-bike motors" });

    expect(await reconcileSessions({ database, getGroup })).toEqual([session({})]);
    expect(getGroup).toHaveBeenCalledWith(42);
  });

  it("closes, rather than ends, a session whose group no longer exists", async () => {
    await database.put(SESSION_STORE, session({}));
    const getGroup = vi.fn().mockRejectedValue(new Error("No group with id: 42"));

    expect(await reconcileSessions({ database, getGroup })).toMatchObject([{ status: "closed" }]);
  });

  it("reopens a closed session whose group exists again", async () => {
    await database.put(SESSION_STORE, session({ status: "closed" }));
    const getGroup = vi.fn().mockResolvedValue({ color: "blue", title: "E-bike motors" });

    expect(await reconcileSessions({ database, getGroup })).toMatchObject([{ status: "active" }]);
  });

  it("asks nothing about an ended session", async () => {
    await database.put(SESSION_STORE, session({ status: "saved" }));
    const getGroup = vi.fn();

    expect(await reconcileSessions({ database, getGroup })).toEqual([]);
    expect(getGroup).not.toHaveBeenCalled();
  });

  it("takes over a title the group gained while nothing was listening", async () => {
    await database.put(SESSION_STORE, session({}));
    const getGroup = vi.fn().mockResolvedValue({ color: "blue", title: "Mid-drive motors" });

    expect(await reconcileSessions({ database, getGroup })).toMatchObject([
      { title: "Mid-drive motors" },
    ]);
  });

  it("reconciles two active sessions and a closed one independently", async () => {
    await database.put(SESSION_STORE, session({ id: "a", groupId: 1, title: "A" }));
    await database.put(SESSION_STORE, session({ id: "b", groupId: 2, title: "B" }));
    await database.put(
      SESSION_STORE,
      session({ id: "c", groupId: 3, title: "C", status: "closed" }),
    );
    const groups: Record<number, { color: string; title: string }> = {
      1: { color: "blue", title: "A" },
      3: { color: "red", title: "C renamed" },
    };
    const getGroup = vi.fn(async (groupId: number) => {
      const group = groups[groupId];

      if (group === undefined) {
        throw new Error(`No group with id: ${groupId}`);
      }

      return group;
    });

    await reconcileSessions({ database, getGroup });

    expect(await database.get(SESSION_STORE, "a")).toMatchObject({ status: "active" });
    expect(await database.get(SESSION_STORE, "b")).toMatchObject({ status: "closed" });
    expect(await database.get(SESSION_STORE, "c")).toMatchObject({
      status: "active",
      title: "C renamed",
    });
  });
});
