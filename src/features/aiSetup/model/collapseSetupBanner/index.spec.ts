import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { collapseSetupBanner } from ".";
import { AI_SETUP_STORE, openResearchDatabase } from "@/shared/storage";

const database = await openResearchDatabase();

beforeEach(async () => {
  await database.clear(AI_SETUP_STORE);
});

describe("collapseSetupBanner", () => {
  it("folds the banner, keeping when setup started", async () => {
    await database.put(AI_SETUP_STORE, { id: "user", startedAt: 3 });
    await collapseSetupBanner(database, true);

    expect(await database.get(AI_SETUP_STORE, "user")).toEqual({
      id: "user",
      startedAt: 3,
      isBannerCollapsed: true,
    });
  });

  it("unfolds it again", async () => {
    await collapseSetupBanner(database, true);
    await collapseSetupBanner(database, false);

    expect(await database.get(AI_SETUP_STORE, "user")).toMatchObject({ isBannerCollapsed: false });
  });
});
