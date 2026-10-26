import type { IDBPDatabase } from "idb";

import { encryptBytes, getDataKey } from "@/features/dataProtection";
import {
  NODE_STORE,
  PAGE_METADATA_STORE,
  type ResearchDatabaseSchema,
  type StoredPageMetadata,
} from "@/shared/storage";

import type { PageMetadata } from "../../types";
import { isTitleMissing } from "./utils/isTitleMissing";

/** What a page said about itself, for the node it was read for. */
export interface RecordedMetadata {
  nodeId: string;
  metadata: PageMetadata;
  capturedAt: number;
}

/**
 * Stores what a page says about itself as its node's one metadata record,
 * replacing an earlier one.
 *
 * The description is sealed with the data key as a snapshot's text is
 * (REQ-SEC-005); the other fields are of the kind the node already shows in the
 * clear. Sealing happens before the transaction, which would otherwise close
 * while it ran. When the node's title says nothing — blank, or only the page's
 * address — it takes the metadata's title instead; a good tab title is left
 * alone.
 *
 * @returns The stored record, or `undefined` when the node does not exist or
 *   the page said nothing.
 */
export const recordPageMetadata = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  { nodeId, metadata, capturedAt }: RecordedMetadata,
): Promise<StoredPageMetadata | undefined> => {
  const { description, ...clear } = metadata;

  if (Object.keys(metadata).length === 0) {
    return undefined;
  }

  const sealed =
    description === undefined
      ? undefined
      : await encryptBytes(await getDataKey(database), new TextEncoder().encode(description));
  const transaction = database.transaction([NODE_STORE, PAGE_METADATA_STORE], "readwrite");
  const nodes = transaction.objectStore(NODE_STORE);
  const node = await nodes.get(nodeId);

  if (node === undefined) {
    await transaction.done;
    return undefined;
  }

  const record: StoredPageMetadata = {
    nodeId,
    sessionId: node.sessionId,
    capturedAt,
    ...clear,
    ...(sealed === undefined
      ? {}
      : {
          keyId: sealed.keyId,
          cipher: sealed.cipher,
          iv: sealed.iv,
          encryptedDescription: sealed.ciphertext,
        }),
  };

  await transaction.objectStore(PAGE_METADATA_STORE).put(record);

  if (clear.title !== undefined && isTitleMissing(node.title, node.url)) {
    await nodes.put({ ...node, title: clear.title });
  }

  await transaction.done;

  return record;
};
