import type { IDBPDatabase } from "idb";

import { getActiveModel } from "@/features/modelRegistry";
import {
  EXTRACTION_STORE,
  NODE_STORE,
  type ResearchDatabaseSchema,
  PAGE_METADATA_STORE,
  SNAPSHOT_STORE,
  VECTOR_STORE,
  SESSION_STORE,
} from "@/shared/storage";

import type { RecordedSession } from "../../types";
import { readRecordedEntities } from "./utils/readRecordedEntities";

/**
 * Everything the live session — active or closed — recorded, page by page:
 * what the page was, the signals kept about it, whether its text was captured
 * how many vectors it has, and how many facts were kept from it and dropped
 * (REQ-SEC-008), and the session's entities, decrypted. The text itself is
 * not included, nor are the facts' text; the text is read on request.
 *
 * @returns The session, or `undefined` when none is live.
 */
export const readRecordedSession = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
): Promise<RecordedSession | undefined> => {
  const session = await database.get(SESSION_STORE, sessionId);

  if (session === undefined) {
    return undefined;
  }

  const nodes = (await database.getAllFromIndex(NODE_STORE, "sessionId", session.id)).toSorted(
    (first, second) => first.createdAt - second.createdAt,
  );
  const pages = await Promise.all(
    nodes.map(async (node) => {
      const [snapshot, metadata, vectorCount, extraction] = await Promise.all([
        node.snapshotId === undefined ? undefined : database.get(SNAPSHOT_STORE, node.snapshotId),
        database.get(PAGE_METADATA_STORE, node.id),
        database.countFromIndex(VECTOR_STORE, "nodeId", node.id),
        node.snapshotId === undefined ? undefined : database.get(EXTRACTION_STORE, node.snapshotId),
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
        metadata:
          metadata === undefined
            ? null
            : {
                ...(metadata.title === undefined ? {} : { title: metadata.title }),
                ...(metadata.siteName === undefined ? {} : { siteName: metadata.siteName }),
                ...(metadata.type === undefined ? {} : { type: metadata.type }),
                ...(metadata.author === undefined ? {} : { author: metadata.author }),
                ...(metadata.publishedAt === undefined
                  ? {}
                  : { publishedAt: metadata.publishedAt }),
                ...(metadata.canonicalUrl === undefined
                  ? {}
                  : { canonicalUrl: metadata.canonicalUrl }),
                ...(metadata.product === undefined ? {} : { product: metadata.product }),
                hasDescription: metadata.encryptedDescription !== undefined,
              },
        vectorCount,
        facts:
          extraction === undefined
            ? null
            : {
                kept: extraction.keptCount,
                dropped: extraction.droppedCount,
                isFinished: extraction.finishedAt !== undefined,
              },
      };
    }),
  );

  return {
    id: session.id,
    title: session.title,
    status: session.status,
    pages,
    canExtractFacts: (await getActiveModel(database, "text-generation")) !== undefined,
    entities: await readRecordedEntities(database, session.id),
  };
};
