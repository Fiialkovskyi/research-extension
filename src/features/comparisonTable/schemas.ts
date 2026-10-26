import * as v from "valibot";

/** One value of a cell, as its sources state it, with each source. */
export const valueGroupSchema = v.object({
  value: v.string(),
  sources: v.array(
    v.object({
      factId: v.string(),
      pageTitle: v.string(),
      url: v.string(),
      quote: v.string(),
      /** The page's site, when it said. */
      siteName: v.optional(v.string()),
      /** The day the page says it was published (`2026-05-01`), when it parsed and was plausible. */
      publishedDate: v.optional(v.string()),
    }),
  ),
  /**
   * Set on the one value, in a conflict, whose newest dated source is strictly
   * later than any other value's. A hint to the reader; it changes no ranking.
   */
  isNewest: v.optional(v.boolean()),
});

/** A cell: the chosen value, its alternatives, and every value with its sources. */
export const comparisonCellSchema = v.object({
  value: v.string(),
  alternativeCount: v.number(),
  isConflict: v.boolean(),
  /**
   * Set when the values are not a disagreement but several values of one thing:
   * a variant such as storage or colour, or a page that lists several. The cell
   * shows them together; the chosen value is still the commonest.
   */
  isOptions: v.optional(v.boolean()),
  groups: v.array(valueGroupSchema),
});

export const comparisonColumnSchema = v.object({ key: v.string(), label: v.string() });

/** The table as the Synthesis page shows it. */
export const comparisonTableSchema = v.object({
  types: v.array(v.object({ type: v.string(), rowCount: v.number() })),
  entityType: v.nullable(v.string()),
  columns: v.array(comparisonColumnSchema),
  /** Attributes of the type not shown, which a column can be added for. */
  otherColumns: v.array(comparisonColumnSchema),
  /** How many statements the user marked wrong in this session (REQ-LIN-008). */
  rejectedCount: v.number(),
  rows: v.array(
    v.object({
      entityId: v.string(),
      name: v.string(),
      /** Cells by column key; a column the row has no fact for is absent. */
      cells: v.record(v.string(), comparisonCellSchema),
    }),
  ),
});

export const comparisonTableRequestSchemas = {
  /** The active session's table, of a type, or of the default type. */
  "table.read": v.object({ entityType: v.optional(v.string()), sessionId: v.optional(v.string()) }),
  /** Replace a type's columns; an empty list returns to the proposed ones. */
  "table.setColumns": v.object({
    entityType: v.string(),
    columns: v.array(v.string()),
    sessionId: v.optional(v.string()),
  }),
} as const;

export const comparisonTableResponseSchemas = {
  "table.view": v.object({ table: v.nullable(comparisonTableSchema), title: v.string() }),
  "table.columnsSaved": v.object({ entityType: v.string() }),
} as const;
