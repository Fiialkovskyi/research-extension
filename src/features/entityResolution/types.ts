import type * as v from "valibot";

import type { resolveEntitiesPayloadSchema, sealedEntitySchema } from "./schemas";

export type SealedEntity = v.InferOutput<typeof sealedEntitySchema>;
export type ResolveEntitiesPayload = v.InferOutput<typeof resolveEntitiesPayloadSchema>;
