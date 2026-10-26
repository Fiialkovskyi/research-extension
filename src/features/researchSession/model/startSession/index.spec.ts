import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { startSession } from ".";
import type { TabGroupApi } from "@/features/tabGroups";
import {
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredSession,
} from "@/shared/storage";

const TAB_ID = 7;
const GROUP_ID = 42;

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(SESSION_STORE);
});

/** An API whose every call succeeds; `getGroup` reports the group as existing. */
const createApi = (overrides: Partial<TabGroupApi> = {}): TabGroupApi => ({
  createTab: vi.fn().mockResolvedValue({ id: TAB_ID }),
  groupTabs: vi.fn().mockResolvedValue(GROUP_ID),
  updateGroup: vi.fn().mockResolvedValue(undefined),
  getGroup: vi.fn().mockResolvedValue({ color: "blue" }),
  activateTab: vi.fn().mockResolvedValue(undefined),
  removeTab: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const recorded = (overrides: Partial<StoredSession> = {}): StoredSession => ({
  id: "earlier",
  title: "E-bike motors",
  groupId: 9,
  formerGroupIds: [],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe("startSession", () => {
  it("creates the group and records it as the active session", async () => {
    const api = createApi();

    const { session, group } = await startSession({ database, title: "Batteries", api });

    expect(group).toEqual({ groupId: GROUP_ID, tabId: TAB_ID, title: "Batteries", color: "blue" });
    expect(session).toMatchObject({ title: "Batteries", groupId: GROUP_ID, status: "active" });
    expect(await database.get(SESSION_STORE, session.id)).toEqual(session);
  });

  it("starts beside an active session without touching it", async () => {
    await database.put(SESSION_STORE, recorded());
    const api = createApi();

    const { session } = await startSession({ database, title: "Batteries", api });

    expect(session).toMatchObject({ title: "Batteries", status: "active" });
    expect(await database.get(SESSION_STORE, "earlier")).toMatchObject({ status: "active" });
    expect(await database.countFromIndex(SESSION_STORE, "status", "active")).toBe(2);
  });

  it("starts beside a closed session, which stays closed", async () => {
    await database.put(SESSION_STORE, recorded({ status: "closed" }));
    const api = createApi();

    await startSession({ database, title: "Batteries", api });

    expect(await database.get(SESSION_STORE, "earlier")).toMatchObject({ status: "closed" });
  });

  it("closes the group's tab when the session cannot be recorded", async () => {
    const api = createApi({
      // A session for the same group appears before the write, as a second
      // start racing this one would leave it.
      createTab: vi.fn(async () => {
        await database.put(SESSION_STORE, recorded({ title: "Raced", groupId: GROUP_ID }));
        return { id: TAB_ID };
      }),
    });

    await expect(startSession({ database, title: "Batteries", api })).rejects.toThrow(
      "That tab group already belongs to a session.",
    );
    expect(api.removeTab).toHaveBeenCalledWith(TAB_ID);
  });
});
