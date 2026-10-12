import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackSessionTabMembership } from ".";
import {
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredSession,
} from "@/shared/storage";

import { NO_TAB_GROUP, SESSION_TAB_VALUE_KEY } from "../../constants";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(SESSION_STORE);
});

const session: StoredSession = {
  id: "session-1",
  title: "E-bike motors",
  groupId: 42,
  formerGroupIds: [],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
};

const createApi = (mark: unknown) => ({
  getTabValue: vi.fn().mockResolvedValue(mark),
  setTabValue: vi.fn().mockResolvedValue(undefined),
  removeTabValue: vi.fn().mockResolvedValue(undefined),
});

describe("trackSessionTabMembership", () => {
  it("marks a tab that joins the session's group", async () => {
    await database.put(SESSION_STORE, session);
    const api = createApi(undefined);

    await trackSessionTabMembership({ database, api, tab: { id: 7, groupId: 42 } });

    expect(api.setTabValue).toHaveBeenCalledWith(7, SESSION_TAB_VALUE_KEY, "session-1");
  });

  it("clears the mark of a session tab that leaves the group", async () => {
    await database.put(SESSION_STORE, session);
    const api = createApi("session-1");

    await trackSessionTabMembership({ database, api, tab: { id: 7, groupId: NO_TAB_GROUP } });

    expect(api.removeTabValue).toHaveBeenCalledWith(7, SESSION_TAB_VALUE_KEY);
  });

  it("leaves alone a tab that was never the session's", async () => {
    await database.put(SESSION_STORE, session);
    const api = createApi(undefined);

    await trackSessionTabMembership({ database, api, tab: { id: 7, groupId: 9 } });

    expect(api.setTabValue).not.toHaveBeenCalled();
    expect(api.removeTabValue).not.toHaveBeenCalled();
  });

  it("does nothing when no session is live", async () => {
    const api = createApi("session-1");

    await trackSessionTabMembership({ database, api, tab: { id: 7, groupId: 42 } });

    expect(api.getTabValue).not.toHaveBeenCalled();
    expect(api.setTabValue).not.toHaveBeenCalled();
  });
});
