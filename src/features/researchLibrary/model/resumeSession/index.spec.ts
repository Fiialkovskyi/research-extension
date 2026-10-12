import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ResumeApi, resumeSession } from ".";
import {
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredSession,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const SAVED: StoredSession = {
  id: "session-1",
  title: "E-bike motors",
  groupId: 42,
  formerGroupIds: [],
  status: "saved",
  savedTabs: [
    { nodeId: "a", url: "https://example.org/a", title: "Page A" },
    { nodeId: "b", url: "https://example.org/b", title: "Page B" },
    { nodeId: "c", url: "https://example.org/c", title: "Page C" },
  ],
  lastPosition: { nodeId: "b", title: "Page B", readFraction: 0.4 },
  createdAt: 1,
  updatedAt: 1,
};

/** A browser that opens tabs 100, 101, … and groups them as group 77. */
const buildApi = (overrides: Partial<ResumeApi> = {}) => {
  let next = 100;
  const api = {
    createTab: vi.fn((_properties: Parameters<ResumeApi["createTab"]>[0]) =>
      Promise.resolve({ id: next++ }),
    ),
    groupTabs: vi.fn(() => Promise.resolve(77)),
    updateGroup: vi.fn(() => Promise.resolve()),
    getGroup: vi.fn(() => Promise.reject(new Error("No group"))),
    activateTab: vi.fn(() => Promise.resolve()),
    removeTab: vi.fn(() => Promise.resolve()),
    ...overrides,
  };

  return api;
};

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all([database.clear(SESSION_STORE), database.clear(NODE_STORE)]);
  await database.put(SESSION_STORE, SAVED);

  for (const [index, id] of ["a", "b", "c"].entries()) {
    await database.put(NODE_STORE, {
      id,
      sessionId: "session-1",
      tabId: index + 1,
      tabState: "closed",
    } as never);
  }
});

describe("resumeSession", () => {
  it("opens the saved tabs in order, only the left-off one loaded, in a group with the session's title", async () => {
    const api = buildApi();

    await resumeSession({ database, sessionId: "session-1", api, now: 9 });

    expect(vi.mocked(api.createTab).mock.calls.map(([properties]) => properties)).toEqual([
      { url: "https://example.org/a", active: false, discarded: true, title: "Page A" },
      { url: "https://example.org/b", active: true },
      { url: "https://example.org/c", active: false, discarded: true, title: "Page C" },
    ]);
    expect(api.groupTabs).toHaveBeenCalledWith({ tabIds: [100, 101, 102] });
    expect(api.updateGroup).toHaveBeenCalledWith(77, { title: "E-bike motors" });
    expect(api.activateTab).toHaveBeenCalledWith(101);
  });

  it("reopens the session's pages on the new tabs, and makes it active on the new group", async () => {
    const resumed = await resumeSession({
      database,
      sessionId: "session-1",
      api: buildApi(),
      now: 9,
    });

    expect(resumed).toMatchObject({ status: "active", groupId: 77, formerGroupIds: [42] });
    expect(
      (await database.getAll(NODE_STORE)).map(({ id, tabId, tabState }) => [id, tabId, tabState]),
    ).toEqual([
      ["a", 100, "open"],
      ["b", 101, "open"],
      ["c", 102, "open"],
    ]);
  });

  it("is refused while another session is active, opening nothing", async () => {
    await database.put(SESSION_STORE, { ...SAVED, id: "other", status: "active", groupId: 5 });

    const api = buildApi({ getGroup: vi.fn(() => Promise.resolve({ color: "blue" })) });

    await expect(resumeSession({ database, sessionId: "session-1", api, now: 9 })).rejects.toThrow(
      "already active",
    );
    expect(api.createTab).not.toHaveBeenCalled();
  });

  it("ends a closed session, as starting one does", async () => {
    await database.put(SESSION_STORE, { ...SAVED, id: "away", status: "closed" });

    await resumeSession({ database, sessionId: "session-1", api: buildApi(), now: 9 });

    expect((await database.get(SESSION_STORE, "away"))?.status).toBe("saved");
  });

  it("closes the tabs it opened when the browser refuses to group them", async () => {
    const api = buildApi({ groupTabs: vi.fn(() => Promise.reject(new Error("No grouping"))) });

    await expect(resumeSession({ database, sessionId: "session-1", api, now: 9 })).rejects.toThrow(
      "No grouping",
    );
    expect(vi.mocked(api.removeTab).mock.calls.map(([id]) => id)).toEqual([100, 101, 102]);
    expect((await database.get(SESSION_STORE, "session-1"))?.status).toBe("saved");
  });
});
