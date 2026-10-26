import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { openResearchDatabase, SETTINGS_STORE } from "@/shared/storage";
import { isPageNoticeEnabled } from ".";

let database: Awaited<ReturnType<typeof openResearchDatabase>>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(SETTINGS_STORE);
});

describe("isPageNoticeEnabled", () => {
  it("is on for a profile that never chose", async () => {
    expect(await isPageNoticeEnabled(database)).toBe(true);
  });

  it("is on when the record holds other settings only", async () => {
    await database.put(SETTINGS_STORE, { id: "user" });

    expect(await isPageNoticeEnabled(database)).toBe(true);
  });

  it("is off once the user turned it off", async () => {
    await database.put(SETTINGS_STORE, { id: "user", isPageNoticeEnabled: false });

    expect(await isPageNoticeEnabled(database)).toBe(false);
  });
});
