import * as v from "valibot";

/** One rule a page broke, with the elements that broke it. */
export const axeViolationSchema = v.object({
  id: v.string(),
  impact: v.nullable(v.string()),
  help: v.string(),
  targets: v.array(v.string()),
});

export const axeViolationsSchema = v.array(axeViolationSchema);
