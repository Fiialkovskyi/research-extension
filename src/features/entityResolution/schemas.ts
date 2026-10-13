import * as v from "valibot";

/** An entity's name and type, as encrypted into the store. */
export const sealedEntitySchema = v.object({
  name: v.string(),
  type: v.string(),
});

/** What a resolution job works on: one extracted page. */
export const resolveEntitiesPayloadSchema = v.object({ snapshotId: v.string() });

/** Messages a surface sends about entities. */
export const entityResolutionRequestSchemas = {
  /** Undo a merge: the entity stands on its own again. */
  "entity.separate": v.object({ entityId: v.string() }),
} as const;

export const entityResolutionResponseSchemas = {
  "entity.separated": v.object({ entityId: v.string(), separated: v.boolean() }),
} as const;
