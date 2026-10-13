import * as v from "valibot";

/** One value of a cell, as its sources state it, with each source. */
export const valueGroupSchema = v.object({
  value: v.string(),
  sources: v.array(
    v.object({ factId: v.string(), pageTitle: v.string(), url: v.string(), quote: v.string() }),
  ),
});

/** A cell: the chosen value, its alternatives, and every value with its sources. */
export const comparisonCellSchema = v.object({
  value: v.string(),
  alternativeCount: v.number(),
  isConflict: v.boolean(),
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
  "table.read": v.object({ entityType: v.optional(v.string()) }),
  /** Replace a type's columns; an empty list returns to the proposed ones. */
  "table.setColumns": v.object({ entityType: v.string(), columns: v.array(v.string()) }),
} as const;

export const comparisonTableResponseSchemas = {
  "table.view": v.object({ table: v.nullable(comparisonTableSchema), title: v.string() }),
  "table.columnsSaved": v.object({ entityType: v.string() }),
} as const;
