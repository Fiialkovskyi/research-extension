import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { saveTableColumns } from ".";
import { getDataKey } from "@/features/dataProtection";
import { openResearchDatabase, SESSION_STORE, TABLE_COLUMNS_STORE } from "@/shared/storage";

import { readSavedColumns } from "../readSavedColumns";

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all([database.clear(SESSION_STORE), database.clear(TABLE_COLUMNS_STORE)]);
  await database.put(SESSION_STORE, {
    id: "s",
    title: "E-bikes",
    groupId: 1,
    formerGroupIds: [],
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });
});

describe("saveTableColumns", () => {
  it("keeps the columns encrypted, under the session and normalised type", async () => {
    const database = await openResearchDatabase();

    expect(await saveTableColumns(database, "Product", ["battery capacity", "weight"])).toBe(true);

    const [stored] = await database.getAll(TABLE_COLUMNS_STORE);

    expect(stored?.id).toBe("s:product");
    expect(JSON.stringify(stored)).not.toContain("battery");
    expect(await readSavedColumns(database, await getDataKey(database), "s", "product")).toEqual([
      "battery capacity",
      "weight",
    ]);
  });

  it("forgets the choice for an empty list", async () => {
    const database = await openResearchDatabase();

    await saveTableColumns(database, "product", ["weight"]);
    await saveTableColumns(database, "product", []);

    expect(
      await readSavedColumns(database, await getDataKey(database), "s", "product"),
    ).toBeUndefined();
  });

  it("keeps nothing without a live session", async () => {
    const database = await openResearchDatabase();

    await database.clear(SESSION_STORE);

    expect(await saveTableColumns(database, "product", ["weight"])).toBe(false);
  });
});
