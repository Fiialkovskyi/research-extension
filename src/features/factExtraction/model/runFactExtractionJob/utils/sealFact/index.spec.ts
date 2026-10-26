import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { sealFact } from ".";
import { decryptBytes, getDataKey } from "@/features/dataProtection";
import { openResearchDatabase } from "@/shared/storage";

const PROVENANCE = {
  modelRef: "ollama:qwen3:4b@abc",
  prompt: "factExtraction@1",
  chunkerVersion: "chunker@1",
  extractedAt: 5,
};

describe("sealFact", () => {
  it("keeps the place and provenance readable and the text only encrypted", async () => {
    const dataKey = await getDataKey(await openResearchDatabase());
    const fact = {
      subject: "Volta E5",
      attribute: "weight",
      concept: "weight",
      value: "23.5",
      unit: "kg",
      quote: "weighs 23.5 kg",
    };
    const stored = await sealFact(
      dataKey,
      fact,
      "product",
      { sessionId: "s", nodeId: "n", snapshotId: "snap", chunkIndex: 2, position: 0 },
      PROVENANCE,
    );

    expect(stored).toMatchObject({
      id: "snap:2:0",
      chunkId: "snap:2",
      sessionId: "s",
      nodeId: "n",
      provenance: PROVENANCE,
    });
    expect(JSON.stringify(stored)).not.toContain("23.5");

    const plain = await decryptBytes(dataKey, {
      keyId: stored.keyId,
      cipher: "aes-gcm-256",
      iv: stored.iv,
      ciphertext: stored.encryptedFact,
    });

    expect(JSON.parse(new TextDecoder().decode(plain))).toEqual({ ...fact, entityType: "product" });
  });
});
