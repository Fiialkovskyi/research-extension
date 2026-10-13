import { type DataKey, encryptBytes } from "@/features/dataProtection";
import type { StoredFact, StoredFactProvenance } from "@/shared/storage";

import type { ExtractedFact } from "../../../../types";

/** Where a fact was found. */
export interface FactPlace {
  sessionId: string;
  nodeId: string;
  snapshotId: string;
  chunkIndex: number;
  /** The fact's position in its chunk's answer. */
  position: number;
}

/**
 * Encrypts a grounded fact's text with the data key into its stored record.
 * Only the text is encrypted; where it was found and what produced it stay
 * readable, so facts can be counted and deleted without the key.
 */
export const sealFact = async (
  dataKey: DataKey,
  fact: ExtractedFact,
  place: FactPlace,
  provenance: StoredFactProvenance,
): Promise<StoredFact> => {
  const { subject, attribute, value, unit, quote } = fact;
  const text = JSON.stringify({
    subject,
    attribute,
    value,
    ...(unit === undefined ? {} : { unit }),
    quote,
  });
  const sealed = await encryptBytes(dataKey, new TextEncoder().encode(text));

  return {
    id: `${place.snapshotId}:${place.chunkIndex}:${place.position}`,
    sessionId: place.sessionId,
    nodeId: place.nodeId,
    snapshotId: place.snapshotId,
    chunkId: `${place.snapshotId}:${place.chunkIndex}`,
    provenance,
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedFact: sealed.ciphertext,
  };
};
