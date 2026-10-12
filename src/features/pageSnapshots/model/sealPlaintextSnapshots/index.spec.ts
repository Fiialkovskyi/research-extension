import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { sealPlaintextSnapshots } from ".";
import { readSnapshotText } from "../readSnapshotText";
import {
  KEY_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SNAPSHOT_STORE,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const gzip = async (text: string): Promise<ArrayBuffer> => {
  const reader = new ReadableStream<BufferSource>({
    start: (controller) => {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  })
    .pipeThrough(new CompressionStream("gzip"))
    .getReader();
  const chunks: number[] = [];

  for (let result = await reader.read(); !result.done; result = await reader.read()) {
    chunks.push(...result.value);
  }

  return new Uint8Array(chunks).buffer;
};

/** A snapshot as version 7 stored it: compressed, in the clear. */
const storeLegacy = async (id: string, text: string) => {
  await database.put(SNAPSHOT_STORE, {
    id,
    sessionId: "session-1",
    nodeId: `node-${id}`,
    contentHash: `hash-${id}`,
    byteLength: text.length,
    truncated: false,
    extractorVersion: "readability@0.6.0/1",
    capturedAt: 1,
    compressedText: await gzip(text),
  } as never);
};

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all([database.clear(SNAPSHOT_STORE), database.clear(KEY_STORE)]);
});

describe("sealPlaintextSnapshots", () => {
  it("encrypts a snapshot stored in the clear, keeping its hash and its text", async () => {
    await storeLegacy("s1", "Mid-drive motors sit at the cranks.");

    expect(await sealPlaintextSnapshots(database)).toBe(1);

    const sealed = await database.get(SNAPSHOT_STORE, "s1");

    expect(sealed).toMatchObject({ contentHash: "hash-s1", cipher: "aes-gcm-256" });
    expect(sealed).not.toHaveProperty("compressedText");
    expect(await readSnapshotText(database, "s1")).toBe("Mid-drive motors sit at the cranks.");
  });

  it("changes nothing the second time", async () => {
    await storeLegacy("s1", "Mid-drive motors.");
    await sealPlaintextSnapshots(database);

    const before = await database.get(SNAPSHOT_STORE, "s1");

    expect(await sealPlaintextSnapshots(database)).toBe(0);
    expect(await database.get(SNAPSHOT_STORE, "s1")).toEqual(before);
  });

  it("creates no key when there is nothing to seal", async () => {
    expect(await sealPlaintextSnapshots(database)).toBe(0);
    expect(await database.count(KEY_STORE)).toBe(0);
  });
});
