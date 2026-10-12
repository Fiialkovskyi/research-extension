import "fake-indexeddb/auto";

import { openDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UPGRADE_STEPS, applyDatabaseUpgrade } from ".";
import {
  CLUSTERING_STORE,
  EDGE_STORE,
  INFERENCE_RUN_STORE,
  JOB_STORE,
  KEY_STORE,
  MODEL_FILE_STORE,
  MODEL_STORE,
  NODE_STORE,
  SESSION_STORE,
  SNAPSHOT_STORE,
} from "../../../constants";
import { type ResearchDatabaseSchema } from "../../../types";

let databaseCount = 0;

/** A fresh database name per test, so cases cannot see each other's schema. */
const getNextDatabaseName = () => `upgrade-test-${(databaseCount += 1)}`;

const openAt = (
  name: string,
  version: number,
  steps?: Parameters<typeof applyDatabaseUpgrade>[4],
) => {
  return openDB<ResearchDatabaseSchema>(name, version, {
    upgrade: (database, oldVersion, newVersion, transaction) => {
      applyDatabaseUpgrade(database, oldVersion, newVersion ?? version, transaction, steps);
    },
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("applyDatabaseUpgrade", () => {
  it("creates every store a fresh profile needs", async () => {
    const database = await openAt(getNextDatabaseName(), 1);

    expect([...database.objectStoreNames].toSorted()).toEqual(
      [MODEL_STORE, MODEL_FILE_STORE, INFERENCE_RUN_STORE].toSorted(),
    );

    database.close();
  });

  it("indexes models by family and files by their model", async () => {
    const database = await openAt(getNextDatabaseName(), 2);

    expect([...database.transaction(MODEL_STORE).store.indexNames]).toContain("family");
    expect([...database.transaction(MODEL_FILE_STORE).store.indexNames]).toContain("ref");
    expect([...database.transaction(INFERENCE_RUN_STORE).store.indexNames]).toContain("modelRef");
    expect([...database.transaction(INFERENCE_RUN_STORE).store.indexNames]).toContain("startedAt");

    database.close();
  });

  it("adds a sessions store keyed by id and indexed by status", async () => {
    const database = await openAt(getNextDatabaseName(), 3);
    const sessions = database.transaction(SESSION_STORE).store;

    expect(sessions.keyPath).toBe("id");
    expect([...sessions.indexNames]).toEqual(["status"]);

    database.close();
  });

  it("keeps a version-2 profile's models and runs when it gains sessions", async () => {
    const name = getNextDatabaseName();
    const before = await openAt(name, 2);

    // Only the keys matter here: the step under test never reads the records.
    await before.put(MODEL_STORE, { ref: "org/model@sha" } as never);
    await before.put(INFERENCE_RUN_STORE, { runId: "run-1", modelRef: "org/model@sha" } as never);
    before.close();

    const after = await openAt(name, 3);

    expect(after.version).toBe(3);
    expect(await after.count(MODEL_STORE)).toBe(1);
    expect(await after.count(INFERENCE_RUN_STORE)).toBe(1);
    expect(await after.count(SESSION_STORE)).toBe(0);

    after.close();
  });

  it("adds the graph stores, indexed for reading a session and a tab's node", async () => {
    const database = await openAt(getNextDatabaseName(), 4);
    const nodes = database.transaction(NODE_STORE).store;
    const edges = database.transaction(EDGE_STORE).store;

    expect(nodes.keyPath).toBe("id");
    expect([...nodes.indexNames].toSorted()).toEqual(["sessionId", "sessionTab"]);
    expect(nodes.index("sessionTab").keyPath).toEqual(["sessionId", "tabId"]);
    expect(edges.keyPath).toBe("id");
    expect([...edges.indexNames]).toEqual(["sessionId"]);

    database.close();
  });

  it("keeps a version-3 profile's sessions when it gains the graph", async () => {
    const name = getNextDatabaseName();
    const before = await openAt(name, 3);

    // Written as version 3 wrote it, before sessions had former groups.
    await before.put(SESSION_STORE, {
      id: "session-1",
      title: "E-bike motors",
      groupId: 42,
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    } as never);
    before.close();

    const after = await openAt(name, 4);

    expect(await after.get(SESSION_STORE, "session-1")).toMatchObject({ title: "E-bike motors" });
    expect(await after.count(NODE_STORE)).toBe(0);

    after.close();
  });

  it("adds a jobs store indexed by status and priority", async () => {
    const database = await openAt(getNextDatabaseName(), 5);
    const jobs = database.transaction(JOB_STORE).store;

    expect(jobs.keyPath).toBe("id");
    expect([...jobs.indexNames]).toEqual(["statusPriority"]);
    expect(jobs.index("statusPriority").keyPath).toEqual(["status", "priority"]);

    database.close();
  });

  it("keeps a version-4 profile's graph when it gains the job queue", async () => {
    const name = getNextDatabaseName();
    const before = await openAt(name, 4);

    // Only the keys matter here: the step under test never reads the records.
    await before.put(NODE_STORE, { id: "node-1", sessionId: "session-1", tabId: 7 } as never);
    await before.put(EDGE_STORE, { id: "a|b|opener", sessionId: "session-1" } as never);
    before.close();

    const after = await openAt(name, 5);

    expect(await after.count(NODE_STORE)).toBe(1);
    expect(await after.count(EDGE_STORE)).toBe(1);
    expect(await after.count(JOB_STORE)).toBe(0);

    after.close();
  });

  it("gives a version-5 profile's sessions an empty list of former groups", async () => {
    const name = getNextDatabaseName();
    const before = await openAt(name, 5);

    // Written as version 5 wrote it, before sessions had former groups.
    await before.put(SESSION_STORE, {
      id: "session-1",
      title: "E-bike motors",
      groupId: 42,
      status: "saved",
      createdAt: 1,
      updatedAt: 1,
    } as never);
    before.close();

    const after = await openAt(name, 6);

    expect(after.version).toBe(6);
    expect(await after.get(SESSION_STORE, "session-1")).toEqual({
      id: "session-1",
      title: "E-bike motors",
      groupId: 42,
      formerGroupIds: [],
      status: "saved",
      createdAt: 1,
      updatedAt: 1,
    });

    after.close();
  });

  it("adds a snapshots store keyed by id, with no index", async () => {
    const database = await openAt(getNextDatabaseName(), 7);
    const snapshots = database.transaction(SNAPSHOT_STORE).store;

    expect(snapshots.keyPath).toBe("id");
    expect([...snapshots.indexNames]).toEqual([]);

    database.close();
  });

  it("keeps a version-6 profile's nodes unchanged when it gains snapshots", async () => {
    const name = getNextDatabaseName();
    const before = await openAt(name, 6);
    const node = { id: "node-1", sessionId: "session-1", tabId: 7, tabState: "open" };

    await before.put(NODE_STORE, node as never);
    before.close();

    const after = await openAt(name, 7);

    expect(after.version).toBe(7);
    expect(await after.get(NODE_STORE, "node-1")).toEqual(node);
    expect(await after.count(SNAPSHOT_STORE)).toBe(0);

    after.close();
  });

  it("adds a keys store keyed by id, and keeps a version-7 profile's snapshots", async () => {
    const name = getNextDatabaseName();
    const before = await openAt(name, 7);
    const snapshot = { id: "snapshot-1", nodeId: "node-1", compressedText: new ArrayBuffer(4) };

    await before.put(SNAPSHOT_STORE, snapshot as never);
    before.close();

    const after = await openAt(name, 8);

    expect(after.version).toBe(8);
    expect(after.transaction(KEY_STORE).store.keyPath).toBe("id");
    expect(await after.get(SNAPSHOT_STORE, "snapshot-1")).toMatchObject({ nodeId: "node-1" });

    after.close();
  });

  it("gives a version-8 profile's nodes a quick-return count of zero", async () => {
    const name = getNextDatabaseName();
    const before = await openAt(name, 8);
    const signals = {
      activeDwellMs: 4,
      maxScroll: 0.5,
      copyEvents: 1,
      focusCount: 2,
      revisitCount: 0,
      quickReturnCount: 0,
    };

    await before.put(NODE_STORE, { id: "node-1", sessionId: "s", tabId: 7, signals } as never);
    before.close();

    const after = await openAt(name, 9);

    expect(after.version).toBe(9);
    expect(await after.get(NODE_STORE, "node-1")).toMatchObject({
      tabId: 7,
      signals: { ...signals, quickReturnCount: 0 },
    });

    after.close();
  });

  it("adds a clusterings store keyed by session", async () => {
    const database = await openAt(getNextDatabaseName(), 10);

    expect(database.version).toBe(10);
    expect(database.transaction(CLUSTERING_STORE).store.keyPath).toBe("sessionId");

    database.close();
  });

  it("keys model files by model and path together, so one model holds many files", async () => {
    const database = await openAt(getNextDatabaseName(), 1);

    expect(database.transaction(MODEL_FILE_STORE).store.keyPath).toEqual(["ref", "path"]);

    database.close();
  });

  it("does not re-run a step when a profile reopens at the same version", async () => {
    const name = getNextDatabaseName();
    const step = vi.fn(UPGRADE_STEPS[1]);

    const first = await openAt(name, 1, { 1: step });
    first.close();

    const second = await openAt(name, 1, { 1: step });
    second.close();

    expect(step).toHaveBeenCalledTimes(1);
  });

  it("runs only the steps a lagging profile has not seen", () => {
    const applied: number[] = [];
    const steps = {
      1: () => applied.push(1),
      2: () => applied.push(2),
      3: () => applied.push(3),
    };

    applyDatabaseUpgrade(
      // The steps under test never touch these, so stand-ins keep the test
      // focused on sequencing rather than on IndexedDB behaviour.
      {} as never,
      1,
      3,
      {} as never,
      steps,
    );

    expect(applied).toEqual([2, 3]);
  });

  it("applies nothing when the profile is already current", () => {
    const step = vi.fn();

    applyDatabaseUpgrade({} as never, 1, 1, {} as never, { 1: step });

    expect(step).not.toHaveBeenCalled();
  });

  it("refuses a gap in the sequence rather than skipping it", () => {
    expect(() => applyDatabaseUpgrade({} as never, 0, 2, {} as never, { 1: () => {} })).toThrow(
      /version 2/,
    );
  });

  it("propagates a failing step rather than swallowing it", () => {
    const steps = {
      1: () => {
        throw new Error("migration step failed");
      },
    };

    expect(() => applyDatabaseUpgrade({} as never, 0, 1, {} as never, steps)).toThrow(
      /migration step failed/,
    );
  });

  it("leaves the previous version intact when an upgrade aborts", async () => {
    const name = getNextDatabaseName();

    const first = await openAt(name, 1);
    first.close();

    // Driven through the raw API rather than the wrapper. A step that throws
    // aborts the version-change transaction, and that abort surfaces on the
    // open request itself; owning every handler here keeps it from escaping as
    // an unhandled rejection and failing the whole run.
    const upgradeAborted = await new Promise<boolean>((resolve, reject) => {
      const request = indexedDB.open(name, 2);

      request.addEventListener("upgradeneeded", () => {
        try {
          applyDatabaseUpgrade(request.result as never, 1, 2, request.transaction as never, {
            2: () => {
              throw new Error("migration step failed");
            },
          });
        } catch {
          request.transaction?.abort();
        }
      });

      request.addEventListener("error", (event) => {
        event.preventDefault();
        resolve(true);
      });

      request.addEventListener("success", () => {
        request.result.close();
        resolve(false);
      });

      request.addEventListener("blocked", () =>
        reject(new Error("upgrade was blocked by another connection")),
      );
    });

    expect(upgradeAborted).toBe(true);

    const reopened = await openAt(name, 1);

    expect(reopened.version).toBe(1);
    expect([...reopened.objectStoreNames]).toContain(MODEL_STORE);

    reopened.close();
  });
});
