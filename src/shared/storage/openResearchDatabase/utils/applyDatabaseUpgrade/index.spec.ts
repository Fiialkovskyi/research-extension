import "fake-indexeddb/auto";

import { openDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UPGRADE_STEPS, applyModelDatabaseUpgrade } from ".";
import { INFERENCE_RUN_STORE, MODEL_FILE_STORE, MODEL_STORE } from "../../../constants";
import { type ModelDatabaseSchema } from "../../../types";

let databaseCount = 0;

/** A fresh database name per test, so cases cannot see each other's schema. */
const getNextDatabaseName = () => `upgrade-test-${(databaseCount += 1)}`;

const openAt = (
  name: string,
  version: number,
  steps?: Parameters<typeof applyModelDatabaseUpgrade>[4],
) => {
  return openDB<ModelDatabaseSchema>(name, version, {
    upgrade: (database, oldVersion, newVersion, transaction) => {
      applyModelDatabaseUpgrade(database, oldVersion, newVersion ?? version, transaction, steps);
    },
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("applyModelDatabaseUpgrade", () => {
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

    applyModelDatabaseUpgrade(
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

    applyModelDatabaseUpgrade({} as never, 1, 1, {} as never, { 1: step });

    expect(step).not.toHaveBeenCalled();
  });

  it("refuses a gap in the sequence rather than skipping it", () => {
    expect(() =>
      applyModelDatabaseUpgrade({} as never, 0, 2, {} as never, { 1: () => {} }),
    ).toThrow(/version 2/);
  });

  it("propagates a failing step rather than swallowing it", () => {
    const steps = {
      1: () => {
        throw new Error("migration step failed");
      },
    };

    expect(() => applyModelDatabaseUpgrade({} as never, 0, 1, {} as never, steps)).toThrow(
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
          applyModelDatabaseUpgrade(request.result as never, 1, 2, request.transaction as never, {
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
