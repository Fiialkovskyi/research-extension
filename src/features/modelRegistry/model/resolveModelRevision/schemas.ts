import * as v from "valibot";

import { commitRevisionSchema } from "@/shared/modelManifest";

/**
 * What the hub reports about a reference. Only the fields we act on.
 *
 * Validated rather than trusted: this is the first value the add-on takes from
 * the network, and an unexpected shape here would be recorded as a model's
 * identity.
 */
export const revisionResponseSchema = v.object({
  sha: commitRevisionSchema,
  /** `false` when open; the hub names the gating mode when it is not. */
  gated: v.optional(v.union([v.boolean(), v.string()])),
});
