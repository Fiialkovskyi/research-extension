import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { sealEntity } from ".";
import { getDataKey } from "@/features/dataProtection";
import { openResearchDatabase } from "@/shared/storage";

import { readSealedEntity } from "../readSealedEntity";

describe("sealEntity", () => {
  it("keeps the session and merge state readable and the name only encrypted", async () => {
    const dataKey = await getDataKey(await openResearchDatabase());
    const stored = await sealEntity(
      dataKey,
      { name: "MacBook Neo 13", type: "product" },
      { id: "e", sessionId: "s", isSeparated: false, createdAt: 1, mergedInto: "root" },
    );

    expect(stored).toMatchObject({ id: "e", sessionId: "s", mergedInto: "root" });
    expect(JSON.stringify(stored)).not.toContain("MacBook");
    expect(await readSealedEntity(dataKey, stored)).toEqual({
      name: "MacBook Neo 13",
      type: "product",
    });
  });
});
