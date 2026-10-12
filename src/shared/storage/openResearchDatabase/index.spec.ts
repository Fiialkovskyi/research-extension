import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { openResearchDatabase } from ".";
import {
  DATABASE_VERSION,
  EDGE_STORE,
  INFERENCE_RUN_STORE,
  JOB_STORE,
  MODEL_FILE_STORE,
  MODEL_STORE,
  NODE_STORE,
  SESSION_STORE,
} from "../constants";

describe("openResearchDatabase", () => {
  it("opens at the current schema version with every store present", async () => {
    const database = await openResearchDatabase();

    expect(database.version).toBe(DATABASE_VERSION);
    expect([...database.objectStoreNames].toSorted()).toEqual(
      [
        MODEL_STORE,
        MODEL_FILE_STORE,
        INFERENCE_RUN_STORE,
        SESSION_STORE,
        NODE_STORE,
        EDGE_STORE,
        JOB_STORE,
      ].toSorted(),
    );

    database.close();
  });

  it("can be opened again, so a woken background rebuilds its handle", async () => {
    const first = await openResearchDatabase();
    first.close();

    const second = await openResearchDatabase();

    expect(second.version).toBe(DATABASE_VERSION);

    second.close();
  });
});
