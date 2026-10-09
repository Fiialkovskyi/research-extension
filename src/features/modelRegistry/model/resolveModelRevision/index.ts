import * as v from "valibot";

import { commitRevisionSchema } from "@/shared/modelManifest";

import { revisionResponseSchema } from "./schemas";
import { getModelRevisionUrl } from "./utils/getModelRevisionUrl";

/**
 * Resolves a repository reference to the immutable commit it points at.
 *
 * A branch name is resolved exactly once, here, and the commit is what gets
 * recorded. Nothing re-resolves it later: a model must keep meaning the same
 * weights for as long as it is installed, and a branch that advances upstream
 * would otherwise silently change what a vector means.
 *
 * A reference that is already a commit is returned untouched, without a
 * request — there is nothing to resolve, and asking anyway would make an
 * offline install impossible for no benefit.
 *
 * @throws when the reference cannot be resolved, or when the repository
 *   requires accepting terms, which the add-on cannot do without sending
 *   credentials it deliberately does not hold.
 */
export const resolveModelRevision = async (
  repository: string,
  reference: string,
  fetchResource: typeof fetch,
): Promise<string> => {
  if (v.safeParse(commitRevisionSchema, reference).success) {
    return reference;
  }

  const url = getModelRevisionUrl(repository, reference);
  const response = await fetchResource(url, {
    // No cookies, no tokens: a model download must not carry an identity.
    credentials: "omit",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Could not resolve ${repository}@${reference}: the hub answered ${response.status}.`,
    );
  }

  const parsed = v.safeParse(revisionResponseSchema, await response.json());

  if (!parsed.success) {
    throw new Error(
      `Could not resolve ${repository}@${reference}: ` +
        `the hub's answer did not carry a commit identifier.`,
    );
  }

  if (parsed.output.gated !== undefined && parsed.output.gated !== false) {
    throw new Error(
      `${repository} is gated (${String(parsed.output.gated)}), so it cannot be installed: ` +
        `access requires accepting terms with an account, and model downloads carry no credentials.`,
    );
  }

  return parsed.output.sha;
};
