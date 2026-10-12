import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { restoreSessionTab } from ".";
import {
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredSession,
} from "@/shared/storage";

import { NO_TAB_GROUP, SESSION_TAB_VALUE_KEY } from "../../constants";
import type { SessionTabApi } from "../../types";

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

/** A browser where the session's group exists and the tab carries `mark`. */
const createApi = (
  mark: unknown = "session-1",
  overrides: Partial<SessionTabApi> = {},
): SessionTabApi => ({
  getTabValue: vi.fn().mockResolvedValue(mark),
  setTabValue: vi.fn().mockResolvedValue(undefined),
  removeTabValue: vi.fn().mockResolvedValue(undefined),
  groupTabs: vi.fn().mockResolvedValue(42),
  updateGroup: vi.fn().mockResolvedValue(undefined),
  getGroup: vi.fn().mockResolvedValue({ id: 42 }),
  ...overrides,
});

const groupGone = () => vi.fn().mockRejectedValue(new Error("No group with id: 42"));

describe("restoreSessionTab", () => {
  it("marks a tab created inside the session's group", async () => {
    await database.put(SESSION_STORE, session);
    const api = createApi(null);

    expect(await restoreSessionTab({ database, api, tab: { id: 7, groupId: 42 } })).toBe("member");
    expect(api.setTabValue).toHaveBeenCalledWith(7, SESSION_TAB_VALUE_KEY, "session-1");
    expect(api.groupTabs).not.toHaveBeenCalled();
  });

  it("tells a session tab that came back inside the group from a new one", async () => {
    await database.put(SESSION_STORE, session);
    const api = createApi();

    expect(await restoreSessionTab({ database, api, tab: { id: 7, groupId: 42 } })).toBe(
      "restored",
    );
    expect(api.setTabValue).not.toHaveBeenCalled();
    expect(api.groupTabs).not.toHaveBeenCalled();
  });

  it("reopens a closed session when its group's tabs come back", async () => {
    await database.put(SESSION_STORE, { ...session, status: "closed" });

    await restoreSessionTab({ database, api: createApi(), tab: { id: 7, groupId: 42 } });

    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({ status: "active" });
  });

  it("puts a session tab restored outside the group back into the group", async () => {
    await database.put(SESSION_STORE, session);
    const api = createApi();

    expect(await restoreSessionTab({ database, api, tab: { id: 7, groupId: NO_TAB_GROUP } })).toBe(
      "joined",
    );
    expect(api.groupTabs).toHaveBeenCalledWith({ tabIds: [7], groupId: 42 });
  });

  it("moves the tabs of a restored former group into the session's current group", async () => {
    await database.put(SESSION_STORE, { ...session, formerGroupIds: [9] });
    const api = createApi();

    expect(await restoreSessionTab({ database, api, tab: { id: 7, groupId: 9 } })).toBe("joined");
    expect(api.groupTabs).toHaveBeenCalledWith({ tabIds: [7], groupId: 42 });
  });

  it("gives a session tab a new group with the session's title once the group is gone for good", async () => {
    await database.put(SESSION_STORE, { ...session, status: "closed" });
    const api = createApi("session-1", {
      getGroup: groupGone(),
      groupTabs: vi.fn().mockResolvedValue(51),
    });

    expect(await restoreSessionTab({ database, api, tab: { id: 7, groupId: NO_TAB_GROUP } })).toBe(
      "regrouped",
    );
    expect(api.groupTabs).toHaveBeenCalledWith({ tabIds: [7] });
    expect(api.updateGroup).toHaveBeenCalledWith(51, { title: "E-bike motors" });
    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({
      groupId: 51,
      formerGroupIds: [42],
      status: "active",
    });
  });

  it("follows a restored former group when the current one is gone", async () => {
    await database.put(SESSION_STORE, { ...session, formerGroupIds: [9], status: "closed" });
    const api = createApi("session-1", { getGroup: groupGone() });

    expect(await restoreSessionTab({ database, api, tab: { id: 7, groupId: 9 } })).toBe("adopted");
    expect(api.groupTabs).not.toHaveBeenCalled();
    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({
      groupId: 9,
      formerGroupIds: [42],
      status: "active",
    });
  });

  it("leaves a marked tab inside an unrelated group where it is", async () => {
    await database.put(SESSION_STORE, session);
    const api = createApi("session-1", { getGroup: groupGone() });

    expect(await restoreSessionTab({ database, api, tab: { id: 7, groupId: 77 } })).toBe("ignored");
    expect(api.groupTabs).not.toHaveBeenCalled();
  });

  it("ignores a tab without the session's mark", async () => {
    await database.put(SESSION_STORE, session);
    const api = createApi("an-ended-session");

    expect(await restoreSessionTab({ database, api, tab: { id: 7, groupId: NO_TAB_GROUP } })).toBe(
      "ignored",
    );
    expect(api.groupTabs).not.toHaveBeenCalled();
  });

  it("asks nothing of the browser when no session is live", async () => {
    await database.put(SESSION_STORE, { ...session, status: "saved" });
    const api = createApi();

    expect(await restoreSessionTab({ database, api, tab: { id: 7, groupId: NO_TAB_GROUP } })).toBe(
      "ignored",
    );
    expect(api.getTabValue).not.toHaveBeenCalled();
  });
});
