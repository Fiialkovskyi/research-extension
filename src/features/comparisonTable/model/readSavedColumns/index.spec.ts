import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { getTableColumnsId, readSavedColumns } from ".";
import { getDataKey } from "@/features/dataProtection";
import { openResearchDatabase, TABLE_COLUMNS_STORE } from "@/shared/storage";

describe("readSavedColumns", () => {
  it("reads nothing when no columns were chosen", async () => {
    const database = await openResearchDatabase();

    expect(
      await readSavedColumns(database, await getDataKey(database), "none", "product"),
    ).toBeUndefined();
  });

  it("reads nothing from a choice that fails to decrypt", async () => {
    const database = await openResearchDatabase();

    await database.put(TABLE_COLUMNS_STORE, {
      id: "broken:product",
      sessionId: "broken",
      keyId: "k",
      iv: new Uint8Array(12),
      encryptedColumns: new ArrayBuffer(32),
    });

    expect(
      await readSavedColumns(database, await getDataKey(database), "broken", "product"),
    ).toBeUndefined();
  });

  it("keys a choice by session and normalised type", () => {
    expect(getTableColumnsId("s", " Product ")).toBe("s:product");
  });
});
