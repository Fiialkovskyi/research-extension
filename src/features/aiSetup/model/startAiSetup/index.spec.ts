import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { startAiSetup } from ".";
import { AI_SETUP_STORE, openResearchDatabase } from "@/shared/storage";

const database = await openResearchDatabase();

beforeEach(async () => {
  await database.clear(AI_SETUP_STORE);
});

describe("startAiSetup", () => {
  it("records when the user started", async () => {
    await startAiSetup(database, 10);

    expect(await database.get(AI_SETUP_STORE, "user")).toEqual({ id: "user", startedAt: 10 });
  });

  it("keeps the first start, and the banner's state", async () => {
    await database.put(AI_SETUP_STORE, { id: "user", isBannerCollapsed: true });
    await startAiSetup(database, 10);
    await startAiSetup(database, 20);

    expect(await database.get(AI_SETUP_STORE, "user")).toEqual({
      id: "user",
      startedAt: 10,
      isBannerCollapsed: true,
    });
  });
});
