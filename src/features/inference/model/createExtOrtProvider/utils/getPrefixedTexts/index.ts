import type { EmbeddingContract } from "@/shared/modelManifest";
import type { EmbeddingRole } from "../../../../types";

/**
 * Applies the prefix a model's contract declares for the text's role.
 *
 * Several embedding models are trained with an instruction on one side only —
 * the query is prefixed, the document is not — and getting this wrong is close
 * to undetectable: the vectors come back the right width and unit length, and
 * the similarities are merely worse than they should be. Nothing downstream can
 * notice, so it is decided here and tested rather than inlined at the call site.
 */
export const getPrefixedTexts = (
  contract: EmbeddingContract,
  role: EmbeddingRole,
  texts: readonly string[],
): string[] => {
  const prefix = contract.prefixes[role];

  return prefix === "" ? [...texts] : texts.map((text) => `${prefix}${text}`);
};
