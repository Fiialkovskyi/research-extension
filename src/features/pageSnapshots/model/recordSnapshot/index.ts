import type { IDBPDatabase } from "idb";

import { encryptBytes, getDataKey } from "@/features/dataProtection";
import {
  NODE_STORE,
  type ResearchDatabaseSchema,
  SNAPSHOT_STORE,
  type StoredSnapshot,
} from "@/shared/storage";

import { compressText } from "./utils/compressText";
import { hashText } from "./utils/hashText";

/** A page's readable text, as the page's script extracted it. */
export interface ExtractedText {
  nodeId: string;
  /** Already cut to the snapshot limit by the page. */
  text: string;
  truncated: boolean;
  extractorVersion: string;
  capturedAt: number;
}

/**
 * Stores a page's readable text as its node's one snapshot (REQ-CAP-006).
 *
 * The text is compressed, then encrypted with the data key (REQ-SEC-005): only
 * ciphertext is stored, and the hash beside it says which pages are equal, not
 * what they say.
 *
 * Hashed here rather than in the page: `crypto.subtle` exists only in secure
 * contexts, which a plain `http` page is not, and the hash is the background's
 * to vouch for. Hashing, compressing and encrypting happen before the
 * transaction, which would otherwise close while they ran; the node is checked
 * again inside it, so a duplicate arriving meanwhile stores nothing.
 *
 * @returns The stored snapshot, or `undefined` when the text is empty, the node
 *   does not exist or already has a snapshot.
 */
export const recordSnapshot = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  extracted: ExtractedText,
): Promise<StoredSnapshot | undefined> => {
  if (extracted.text.trim() === "") {
    return undefined;
  }

  const [contentHash, compressedText, dataKey] = await Promise.all([
    hashText(extracted.text),
    compressText(extracted.text),
    getDataKey(database),
  ]);
  const sealed = await encryptBytes(dataKey, compressedText);
  const transaction = database.transaction([NODE_STORE, SNAPSHOT_STORE], "readwrite");
  const nodes = transaction.objectStore(NODE_STORE);
  const node = await nodes.get(extracted.nodeId);

  if (node === undefined || node.snapshotId !== undefined) {
    await transaction.done;
    return undefined;
  }

  const snapshot: StoredSnapshot = {
    id: crypto.randomUUID(),
    sessionId: node.sessionId,
    nodeId: node.id,
    contentHash,
    byteLength: new TextEncoder().encode(extracted.text).byteLength,
    truncated: extracted.truncated,
    extractorVersion: extracted.extractorVersion,
    capturedAt: extracted.capturedAt,
    keyId: sealed.keyId,
    cipher: sealed.cipher,
    iv: sealed.iv,
    encryptedText: sealed.ciphertext,
  };

  await transaction.objectStore(SNAPSHOT_STORE).add(snapshot);
  await nodes.put({ ...node, snapshotId: snapshot.id, contentHash });
  await transaction.done;

  return snapshot;
};
