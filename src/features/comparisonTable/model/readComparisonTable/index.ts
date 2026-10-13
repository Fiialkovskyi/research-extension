import type { IDBPDatabase } from "idb";

import { getDataKey } from "@/features/dataProtection";
import { readSealedEntity } from "@/features/entityResolution";
import { readSealedFact } from "@/features/factExtraction";
import { getLiveSession } from "@/features/researchSession";
import { normalizeEntityName } from "@/shared/normalizeEntityName";
import {
  ENTITY_STORE,
  FACT_STORE,
  NODE_STORE,
  type ResearchDatabaseSchema,
} from "@/shared/storage";

import type { ComparisonTable, TableFact } from "../../types";
import { buildCell } from "../buildCell";
import { proposeColumns } from "../proposeColumns";
import { readSavedColumns } from "../readSavedColumns";

/** The live session's title and its comparison table. */
export interface ComparisonTableView {
  title: string;
  table: ComparisonTable;
}

/**
 * Builds the live session's comparison table from its facts (REQ-SYN-005,
 * REQ-SYN-006), with no model: rows are the root entities of one type that
 * have facts — `entityType`, or the type with most such entities — columns are
 * the user's or the proposed ones, and each cell chooses a value and flags a
 * conflict. Facts not yet assigned to an entity are left out.
 *
 * @returns The table, or `undefined` without a live session.
 */
export const readComparisonTable = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  entityType?: string,
): Promise<ComparisonTableView | undefined> => {
  const session = await getLiveSession(database);

  if (session === undefined) {
    return undefined;
  }

  const dataKey = await getDataKey(database);
  const [stored, entities] = await Promise.all([
    database.getAllFromIndex(FACT_STORE, "sessionId", session.id),
    database.getAllFromIndex(ENTITY_STORE, "sessionId", session.id),
  ]);
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const names = new Map(
    await Promise.all(
      entities.map(async (entity) => [entity.id, await readSealedEntity(dataKey, entity)] as const),
    ),
  );
  /** The row a fact's entity resolves to. */
  const readRoot = (entityId: string): string => {
    const mergedInto = byId.get(entityId)?.mergedInto;

    return mergedInto !== undefined && byId.has(mergedInto) ? mergedInto : entityId;
  };
  const pages = new Map<string, { title: string; url: string }>();
  const facts: (TableFact & { type: string })[] = [];

  for (const fact of stored) {
    if (fact.entityId !== undefined) {
      const rowId = readRoot(fact.entityId);
      const type = names.get(rowId)?.type ?? "unknown";
      const { attribute, value, unit, quote } = await readSealedFact(dataKey, fact);

      if (!pages.has(fact.nodeId)) {
        const node = await database.get(NODE_STORE, fact.nodeId);

        pages.set(fact.nodeId, {
          title: node === undefined || node.title.trim() === "" ? (node?.url ?? "") : node.title,
          url: node?.url ?? "",
        });
      }

      facts.push({
        id: fact.id,
        rowId,
        nodeId: fact.nodeId,
        attribute,
        attributeKey: normalizeEntityName(attribute),
        value,
        ...(unit === undefined ? {} : { unit }),
        quote,
        pageTitle: pages.get(fact.nodeId)?.title ?? "",
        url: pages.get(fact.nodeId)?.url ?? "",
        type,
      });
    }
  }

  const rowsByType = Map.groupBy(facts, ({ type }) => type);
  const types = [...rowsByType.entries()]
    .map(([type, members]) => ({ type, rowCount: new Set(members.map(({ rowId }) => rowId)).size }))
    .toSorted((a, b) => b.rowCount - a.rowCount || a.type.localeCompare(b.type));
  const chosen =
    types.find(
      ({ type }) =>
        entityType !== undefined && normalizeEntityName(type) === normalizeEntityName(entityType),
    ) ?? types[0];

  if (chosen === undefined) {
    return {
      title: session.title,
      table: { types: [], entityType: null, columns: [], otherColumns: [], rows: [] },
    };
  }

  const typeFacts = rowsByType.get(chosen.type) ?? [];
  const { columns, otherColumns } = proposeColumns(
    typeFacts,
    await readSavedColumns(database, dataKey, session.id, chosen.type),
  );
  const rows = [...Map.groupBy(typeFacts, ({ rowId }) => rowId).entries()]
    .toSorted(([, a], [, b]) => b.length - a.length)
    .map(([rowId, rowFacts]) => {
      const byColumn = Map.groupBy(rowFacts, ({ attributeKey }) => attributeKey);

      return {
        entityId: rowId,
        name: names.get(rowId)?.name ?? rowId,
        cells: Object.fromEntries(
          columns.flatMap(({ key }) => {
            const cellFacts = byColumn.get(key);

            return cellFacts === undefined ? [] : [[key, buildCell(cellFacts)]];
          }),
        ),
      };
    });

  return {
    title: session.title,
    table: { types, entityType: chosen.type, columns, otherColumns, rows },
  };
};
