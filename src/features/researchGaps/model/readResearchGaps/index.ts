import type { IDBPDatabase } from "idb";

import { readComparisonTable } from "@/features/comparisonTable";
import { getLiveSession } from "@/features/researchSession";
import { NODE_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

import type { ResearchGaps } from "../../types";
import { buildGapQuery } from "../buildGapQuery";
import { findCategoryGaps } from "../findCategoryGaps";
import { findCellGaps } from "../findCellGaps";

/**
 * Reads the live session's gaps (REQ-SYN-008), each with its search: the
 * comparison table's empty cells of confirmed entities — for the table of
 * `entityType`, as the page shows it — and the kinds of source no page of the
 * session is. Computed now, with no model, so never stale.
 *
 * @returns The gaps, or `undefined` without a live session.
 */
export const readResearchGaps = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  entityType?: string,
): Promise<ResearchGaps | undefined> => {
  const session = await getLiveSession(database);

  if (session === undefined) {
    return undefined;
  }

  const [view, nodes] = await Promise.all([
    readComparisonTable(database, entityType),
    database.getAllFromIndex(NODE_STORE, "sessionId", session.id),
  ]);
  const table = view?.table;
  const subject = table?.rows[0]?.name ?? session.title;
  const { gaps, moreCount } =
    table === undefined ? { gaps: [], moreCount: 0 } : findCellGaps(table);
  const pages = nodes.filter(({ kind }) => kind !== "serp").map(({ url }) => url);

  return {
    cellGaps: gaps.map((cell) => buildGapQuery({ kind: "cell", cell }, subject)),
    moreCellGaps: moreCount,
    categoryGaps: findCategoryGaps(pages).map((category) =>
      buildGapQuery({ kind: "category", category }, subject),
    ),
  };
};
