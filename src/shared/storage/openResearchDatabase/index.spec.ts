import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { openModelDatabase } from ".";
import {
  INFERENCE_RUN_STORE,
  MODEL_DATABASE_VERSION,
  MODEL_FILE_STORE,
  MODEL_STORE,
} from "../constants";

describe("openModelDatabase", () => {
  it("opens at the current schema version with every store present", async () => {
    const database = await openModelDatabase();

    expect(database.version).toBe(MODEL_DATABASE_VERSION);
    expect([...database.objectStoreNames].toSorted()).toEqual(
      [MODEL_STORE, MODEL_FILE_STORE, INFERENCE_RUN_STORE].toSorted(),
    );

    database.close();
  });

  it("can be opened again, so a woken background rebuilds its handle", async () => {
    const first = await openModelDatabase();
    first.close();

    const second = await openModelDatabase();

    expect(second.version).toBe(MODEL_DATABASE_VERSION);

    second.close();
  });
});
