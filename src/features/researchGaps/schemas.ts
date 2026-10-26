import * as v from "valibot";

/** One gap as the Synthesis page shows it: what is missing, and the search for it. */
export const researchGapSchema = v.object({
  kind: v.picklist(["cell", "category"]),
  text: v.string(),
  query: v.string(),
});

export const researchGapsSchema = v.object({
  cellGaps: v.array(researchGapSchema),
  /** Cell gaps beyond those listed. */
  moreCellGaps: v.number(),
  categoryGaps: v.array(researchGapSchema),
});

export const researchGapRequestSchemas = {
  /** The live session's gaps, against the table of a type. */
  "gaps.read": v.object({ entityType: v.optional(v.string()), sessionId: v.optional(v.string()) }),
  /** Run a gap's query as a search in a new tab of the session's group. */
  "gaps.search": v.object({
    query: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
    sessionId: v.optional(v.string()),
  }),
} as const;

export const researchGapResponseSchemas = {
  "gaps.view": v.object({ gaps: v.nullable(researchGapsSchema) }),
  "gaps.searchOpened": v.object({ url: v.string() }),
} as const;
