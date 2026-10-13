import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { readSealedFact } from ".";
import { encryptBytes, getDataKey } from "@/features/dataProtection";
import { openResearchDatabase, type StoredFact } from "@/shared/storage";

/** A stored fact whose encrypted text is `text`. */
const storeFact = async (text: object): Promise<StoredFact> => {
  const dataKey = await getDataKey(await openResearchDatabase());
  const sealed = await encryptBytes(dataKey, new TextEncoder().encode(JSON.stringify(text)));

  return {
    id: "s:0:0",
    sessionId: "session-1",
    nodeId: "n",
    snapshotId: "s",
    chunkId: "s:0",
    provenance: { modelRef: "m", prompt: "factExtraction@1", chunkerVersion: "c", extractedAt: 1 },
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedFact: sealed.ciphertext,
  };
};

const FACT = { subject: "Volta E5", attribute: "weight", value: "23.5", unit: "kg", quote: "q" };

describe("readSealedFact", () => {
  it("reads a fact's text with its subject's type", async () => {
    const dataKey = await getDataKey(await openResearchDatabase());
    const stored = await storeFact({ ...FACT, entityType: "product" });

    expect(await readSealedFact(dataKey, stored)).toEqual({ ...FACT, entityType: "product" });
  });

  it("reads a fact stored before types were kept as type unknown", async () => {
    const dataKey = await getDataKey(await openResearchDatabase());

    expect((await readSealedFact(dataKey, await storeFact(FACT))).entityType).toBe("unknown");
  });
});
