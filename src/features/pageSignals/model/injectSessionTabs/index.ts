import type { IDBPDatabase } from "idb";

import { readSessionGraph } from "@/features/researchGraph";
import { getActiveSession } from "@/features/researchSession";
import type { ResearchDatabaseSchema } from "@/shared/storage";

import type { PageSignalsApi } from "../../types";
import { injectPageObserver } from "../injectPageObserver";

/**
 * Starts observing every page the active session's tabs show: after page access
 * is granted, and when capture is reconciled, so pages loaded while the
 * observer could not be injected are observed without a reload.
 *
 * @returns The tabs the observer was injected into.
 */
export const injectSessionTabs = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  api: Pick<PageSignalsApi, "executeScript">,
): Promise<number[]> => {
  const session = await getActiveSession(database);

  if (session === undefined) {
    return [];
  }

  const { nodes } = await readSessionGraph(database, session.id);
  const tabIds = [
    ...new Set(nodes.filter((node) => node.tabState === "open").map((node) => node.tabId)),
  ];
  const injected = await Promise.all(tabIds.map((tabId) => injectPageObserver(api, tabId)));

  return tabIds.filter((_, index) => injected[index]);
};
