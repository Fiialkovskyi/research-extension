import * as v from "valibot";

export const envelopeSchema = v.object({
  v: v.number(),
  type: v.string(),
  id: v.string(),
  payload: v.unknown(),
});
