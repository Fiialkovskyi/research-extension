import type { IDBPDatabase } from "idb";

import { getLiveSession } from "@/features/researchSession";
import {
  NODE_STORE,
  type ResearchDatabaseSchema,
  SNAPSHOT_STORE,
  VECTOR_STORE,
} from "@/shared/storage";

import type { RecordedSession } from "../../types";

/**
 * Everything the live session — active or closed — recorded, page by page:
 * what the page was, the signals kept about it, whether its text was captured
 * and how many vectors it has (REQ-SEC-008). The text itself is not included;
 * it is read on request.
 *
 * @returns The session, or `undefined` when none is live.
 */
export const readRecordedSession = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<RecordedSession | undefined> => {
  const session = await getLiveSession(database);

  if (session === undefined) {
    return undefined;
  }

  const nodes = (await database.getAllFromIndex(NODE_STORE, "sessionId", session.id)).toSorted(
    (first, second) => first.createdAt - second.createdAt,
  );
  const pages = await Promise.all(
    nodes.map(async (node) => {
      const [snapshot, vectorCount] = await Promise.all([
        node.snapshotId === undefined ? undefined : database.get(SNAPSHOT_STORE, node.snapshotId),
        database.countFromIndex(VECTOR_STORE, "nodeId", node.id),
      ]);

      return {
        id: node.id,
        title: node.title,
        url: node.url,
        domain: node.domain,
        kind: node.kind,
        tabState: node.tabState,
        createdAt: node.createdAt,
        signals: { ...node.signals },
        snapshot:
          snapshot === undefined
            ? null
            : {
                byteLength: snapshot.byteLength,
                truncated: snapshot.truncated,
                capturedAt: snapshot.capturedAt,
              },
        vectorCount,
      };
    }),
  );

  return { id: session.id, title: session.title, status: session.status, pages };
};
