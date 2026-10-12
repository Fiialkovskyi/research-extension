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

  it("refuses without opening a tab while a live session is active", async () => {
    await database.put(SESSION_STORE, recorded());
    const api = createApi({
      getGroup: vi.fn().mockResolvedValue({ color: "blue", title: "E-bike motors" }),
    });

    await expect(startSession({ database, title: "Batteries", api })).rejects.toThrow(
      'A session is already active: "E-bike motors".',
    );
    expect(api.createTab).not.toHaveBeenCalled();
  });

  it("ends a session whose group has gone, then starts", async () => {
    await database.put(SESSION_STORE, recorded());
    const getGroup = vi
      .fn<TabGroupApi["getGroup"]>()
      .mockRejectedValueOnce(new Error("No group with id: 9"))
      .mockResolvedValue({ color: "blue" });
    const api = createApi({ getGroup });

    const { session } = await startSession({ database, title: "Batteries", api });

    expect(await database.get(SESSION_STORE, "earlier")).toMatchObject({ status: "saved" });
    expect(session).toMatchObject({ title: "Batteries", status: "active" });
  });

  it("closes the group's tab when the session cannot be recorded", async () => {
    const api = createApi({
      // A session appears between the early check and the write, as a second
      // start racing this one would leave it.
      createTab: vi.fn(async () => {
        await database.put(SESSION_STORE, recorded({ title: "Raced" }));
        return { id: TAB_ID };
      }),
    });

    await expect(startSession({ database, title: "Batteries", api })).rejects.toThrow(
      'A session is already active: "Raced".',
    );
    expect(api.removeTab).toHaveBeenCalledWith(TAB_ID);
  });
});
