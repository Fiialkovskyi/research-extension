import type { EmbeddingContract, ModelReference } from "@/shared/modelManifest";
import type { StoredSpace } from "@/shared/storage";

import { CHUNKER_VERSION } from "../../constants";

export interface BuildEmbeddingSpaceOptions {
  reference: ModelReference;
  contract: EmbeddingContract;
  /** The extractor that produced the snapshots' text. */
  extractorVersion: string;
  quantization?: string;
  now: number;
}

/** JSON with object keys sorted at every depth, so equal choices give equal text. */
const toCanonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, nested: unknown) =>
    nested !== null && typeof nested === "object" && !Array.isArray(nested)
      ? Object.fromEntries(
          Object.entries(nested).toSorted(([first], [second]) => first.localeCompare(second)),
        )
      : nested,
  );

/**
 * Describes the embedding space a model's vectors land in (target spec §7):
 * every choice that decides what a vector means, identified by the SHA-256 of
 * their canonical JSON. A new commit, a different chunker or extractor — any
 * change that makes vectors incomparable — gives a new space.
 */
export const buildEmbeddingSpace = async ({
  reference,
  contract,
  extractorVersion,
  quantization,
  now,
}: BuildEmbeddingSpaceOptions): Promise<StoredSpace> => {
  const fields = {
    model: { repository: reference.repository, revision: reference.revision },
    dims: contract.dimensions,
    pooling: contract.pooling,
    normalize: contract.normalize,
    similarity: contract.similarity,
    prefixes: { query: contract.prefixes.query, document: contract.prefixes.document },
    chunkerVersion: CHUNKER_VERSION,
    extractorVersion,
    quantization: quantization ?? null,
  };
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(toCanonicalJson(fields)),
  );
  const id = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

  return { id, ...fields, createdAt: now };
};
