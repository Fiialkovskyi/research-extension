import type { IDBPDatabase } from "idb";

import { PAGE_METADATA_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

import type { PageSourceDetails } from "../../types";
import { parsePublishedDate } from "./utils/parsePublishedDate";

/**
 * Reads what names a page as a source: its site and the day it was published.
 *
 * Neither is sealed, so nothing is decrypted. A node with no metadata, or with
 * neither field usable, has no entry; a publication time that does not parse or
 * is not plausible gives no date.
 *
 * @returns The details by node id, for the nodes that have any.
 */
export const readPageSourceDetails = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  nodeIds: readonly string[],
  now: number = Date.now(),
): Promise<Map<string, PageSourceDetails>> => {
  const details = new Map<string, PageSourceDetails>();

  await Promise.all(
    [...new Set(nodeIds)].map(async (nodeId) => {
      const record = await database.get(PAGE_METADATA_STORE, nodeId);

      if (record === undefined) {
        return;
      }

      const published =
        record.publishedAt === undefined ? undefined : parsePublishedDate(record.publishedAt, now);

      if (record.siteName !== undefined || published !== undefined) {
        details.set(nodeId, {
          ...(record.siteName === undefined ? {} : { siteName: record.siteName }),
          ...(published === undefined
            ? {}
            : { publishedDate: published.date, publishedTime: published.time }),
        });
      }
    }),
  );

  return details;
};
