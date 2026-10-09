import * as v from "valibot";

import { buildHubUrl } from "../buildHubUrl";
import { HUGGING_FACE_RESOLVE_SEGMENT } from "../constants";
import { commitRevisionSchema, type ModelReference } from "@/shared/modelManifest";

/**
 * Builds the URL of one file at one pinned revision.
 *
 * The revision must already be a commit. Addressing a file by branch would mean
 * the bytes that arrive depend on when the request was made, which is exactly
 * what pinning exists to prevent — and it would make the manifest's digests
 * meaningless, since they describe the files of one specific commit.
 *
 * @throws when the reference is not pinned to a commit, when its repository is
 *   not `owner/name`, or when the path carries a segment that would address
 *   something else.
 */
export const getHuggingFaceFileUrl = (reference: ModelReference, path: string): string => {
  if (!v.safeParse(commitRevisionSchema, reference.revision).success) {
    throw new Error(
      `Refusing to address ${reference.repository} at "${reference.revision}": ` +
        `a file request must name a commit, not a moving reference.`,
    );
  }

  const repository = reference.repository.split("/");

  if (repository.length !== 2) {
    throw new Error(`Refusing to address "${reference.repository}": expected owner/name.`);
  }

  return buildHubUrl("/", [
    ...repository,
    HUGGING_FACE_RESOLVE_SEGMENT,
    reference.revision,
    ...path.split("/"),
  ]);
};
