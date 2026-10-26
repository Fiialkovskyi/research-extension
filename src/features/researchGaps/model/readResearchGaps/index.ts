import type { IDBPDatabase } from "idb";

import { readComparisonTable } from "@/features/comparisonTable";
import {
  NODE_STORE,
  PAGE_METADATA_STORE,
  type ResearchDatabaseSchema,
  SESSION_STORE,
} from "@/shared/storage";

import type { ResearchGaps } from "../../types";
import { buildGapQuery } from "../buildGapQuery";
import { findCategoryGaps } from "../findCategoryGaps";
import { findCellGaps } from "../findCellGaps";
import { readSourceKind } from "../readSourceKind";

/**
 * Reads the live session's gaps (REQ-SYN-008), each with its search: the
 * comparison table's empty cells of confirmed entities — for the table of
 * `entityType`, as the page shows it — and the kinds of source no page of the
 * session is, when its pages' own data can tell. Computed now, with no model, so never stale.
 *
 * @returns The gaps, or `undefined` without a live session.
 */
export const readResearchGaps = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  entityType?: string,
): Promise<ResearchGaps | undefined> => {
  const session = await database.get(SESSION_STORE, sessionId);

  if (session === undefined) {
    return undefined;
  }

  const [view, nodes] = await Promise.all([
    readComparisonTable(database, sessionId, entityType),
    database.getAllFromIndex(NODE_STORE, "sessionId", session.id),
  ]);
  const table = view?.table;
  const subject = table?.rows[0]?.name ?? session.title;
  const { gaps, moreCount } =
    table === undefined ? { gaps: [], moreCount: 0 } : findCellGaps(table);
  const kinds = await Promise.all(
    nodes
      .filter(({ kind }) => kind !== "serp")
      .map(async ({ id }) => {
        const metadata = await database.get(PAGE_METADATA_STORE, id);

        return metadata === undefined ? undefined : readSourceKind(metadata);
      }),
  );

  return {
    cellGaps: gaps.map((cell) => buildGapQuery({ kind: "cell", cell }, subject)),
    moreCellGaps: moreCount,
    categoryGaps: findCategoryGaps(kinds).map((category) =>
      buildGapQuery({ kind: "category", category }, subject),
    ),
  };
};
