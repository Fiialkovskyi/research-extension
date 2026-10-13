import type * as v from "valibot";

import type {
  comparisonCellSchema,
  comparisonColumnSchema,
  comparisonTableSchema,
  valueGroupSchema,
} from "./schemas";

/** A fact as the table is built from it: decrypted, with its row and its page. */
export interface TableFact {
  id: string;
  /** The root entity it belongs to: the row. */
  rowId: string;
  nodeId: string;
  attribute: string;
  /** The attribute, normalised: the column it falls in. */
  attributeKey: string;
  value: string;
  unit?: string;
  quote: string;
  pageTitle: string;
  url: string;
}

export type ValueGroup = v.InferOutput<typeof valueGroupSchema>;
export type ComparisonCell = v.InferOutput<typeof comparisonCellSchema>;
export type ComparisonColumn = v.InferOutput<typeof comparisonColumnSchema>;
export type ComparisonTable = v.InferOutput<typeof comparisonTableSchema>;
