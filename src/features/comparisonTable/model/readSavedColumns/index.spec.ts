import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { getTableColumnsId, readSavedColumns } from ".";
import { getDataKey } from "@/features/dataProtection";
import { openResearchDatabase } from "@/shared/storage";

describe("readSavedColumns", () => {
  it("reads nothing when no columns were chosen", async () => {
    const database = await openResearchDatabase();

    expect(
      await readSavedColumns(database, await getDataKey(database), "none", "product"),
    ).toBeUndefined();
  });

  it("keys a choice by session and normalised type", () => {
    expect(getTableColumnsId("s", " Product ")).toBe("s:product");
  });
});
