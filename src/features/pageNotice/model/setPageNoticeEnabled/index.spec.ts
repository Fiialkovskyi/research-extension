import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { openResearchDatabase, SETTINGS_STORE } from "@/shared/storage";
import { isPageNoticeEnabled } from "../isPageNoticeEnabled";
import { setPageNoticeEnabled } from ".";

let database: Awaited<ReturnType<typeof openResearchDatabase>>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(SETTINGS_STORE);
});

describe("setPageNoticeEnabled", () => {
  it("turns the notice off, and on again", async () => {
    await setPageNoticeEnabled(database, false);

    expect(await isPageNoticeEnabled(database)).toBe(false);

    await setPageNoticeEnabled(database, true);

    expect(await isPageNoticeEnabled(database)).toBe(true);
  });

  it("keeps the rest of the record", async () => {
    await database.put(SETTINGS_STORE, { id: "user", extra: 1 } as never);

    await setPageNoticeEnabled(database, false);

    expect(await database.get(SETTINGS_STORE, "user")).toEqual({
      id: "user",
      extra: 1,
      isPageNoticeEnabled: false,
    });
  });
});
