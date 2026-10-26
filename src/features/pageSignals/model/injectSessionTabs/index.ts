import type { IDBPDatabase } from "idb";

import { readSessionGraph } from "@/features/researchGraph";
import { listLiveSessions } from "@/features/researchSession";
import type { ResearchDatabaseSchema } from "@/shared/storage";

import type { PageSignalsApi } from "../../types";
import { injectPageObserver } from "../injectPageObserver";

/**
 * Starts observing every page the active sessions' tabs show: after page access
 * is granted, and when capture is reconciled, so pages loaded while the
 * observer could not be injected are observed without a reload.
 *
 * @returns The tabs the observer was injected into.
 */
export const injectSessionTabs = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  api: Pick<PageSignalsApi, "executeScript">,
): Promise<number[]> => {
  const sessions = (await listLiveSessions(database)).filter(({ status }) => status === "active");
  const graphs = await Promise.all(sessions.map(({ id }) => readSessionGraph(database, id)));
  const tabIds = [
    ...new Set(
      graphs.flatMap(({ nodes }) =>
        nodes.filter((node) => node.tabState === "open").map((node) => node.tabId),
      ),
    ),
  ];
  const injected = await Promise.all(tabIds.map((tabId) => injectPageObserver(api, tabId)));

  return tabIds.filter((_, index) => injected[index]);
};
