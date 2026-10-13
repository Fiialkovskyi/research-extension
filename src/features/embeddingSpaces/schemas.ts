import * as v from "valibot";

/** One embedding space as the options page shows it. */
export const spaceUsageSchema = v.object({
  id: v.string(),
  repository: v.string(),
  revision: v.string(),
  vectorCount: v.number(),
  /** Vector count × dims × 4 bytes: the floats alone. */
  approximateBytes: v.number(),
  inUse: v.boolean(),
  retiredAt: v.nullable(v.number()),
  removedAt: v.nullable(v.number()),
});

export const embeddingSpaceRequestSchemas = {
  "spaces.list": v.object({}),
  /** Delete a retired space's vectors now. */
  "spaces.remove": v.object({ spaceId: v.string() }),
} as const;

export const embeddingSpaceResponseSchemas = {
  "spaces.listed": v.object({ spaces: v.array(spaceUsageSchema) }),
  "spaces.removed": v.object({ spaceId: v.string(), removed: v.boolean() }),
} as const;
