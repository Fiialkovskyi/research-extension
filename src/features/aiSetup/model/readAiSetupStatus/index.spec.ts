import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readAiSetupStatus } from ".";
import { AI_SETUP_STORE, MODEL_STORE, openResearchDatabase } from "@/shared/storage";

const database = await openResearchDatabase();

beforeEach(async () => {
  await database.clear(AI_SETUP_STORE);
  await database.clear(MODEL_STORE);
});

describe("readAiSetupStatus", () => {
  it("says a fresh install is neither set up nor started, its banner unfolded", async () => {
    expect(await readAiSetupStatus(database)).toEqual({
      isSetUp: false,
      isStarted: false,
      isBannerCollapsed: false,
    });
  });

  it("reads whether setup started and how the banner was left", async () => {
    await database.put(AI_SETUP_STORE, { id: "user", startedAt: 5, isBannerCollapsed: true });

    expect(await readAiSetupStatus(database)).toMatchObject({
      isStarted: true,
      isBannerCollapsed: true,
    });
  });

  it("is set up once an embedding model is active", async () => {
    await database.put(MODEL_STORE, {
      ref: "ollama/nomic-embed-text@a",
      manifest: { contract: { family: "embedding" } },
      active: true,
      conformance: "passed",
    } as never);

    expect(await readAiSetupStatus(database)).toMatchObject({ isSetUp: true });
  });
});
