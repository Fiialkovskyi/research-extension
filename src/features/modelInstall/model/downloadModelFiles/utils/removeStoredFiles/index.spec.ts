import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { removeStoredFiles } from ".";
import {
  MODEL_FILE_STORE,
  type ResearchDatabaseSchema,
  openResearchDatabase,
} from "@/shared/storage";

const firstRef = "owner/first@" + "a".repeat(40);
const secondRef = "owner/second@" + "b".repeat(40);

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(MODEL_FILE_STORE);
});

const storeFile = (ref: string, path: string) =>
  database.put(MODEL_FILE_STORE, { ref, path, contents: new ArrayBuffer(1) });

describe("removeStoredFiles", () => {
  it("removes every file stored for the model", async () => {
    await storeFile(firstRef, "config.json");
    await storeFile(firstRef, "onnx/model.onnx");

    await removeStoredFiles(database, firstRef);

    expect(await database.getAllFromIndex(MODEL_FILE_STORE, "ref", firstRef)).toEqual([]);
  });

  it("leaves the files of every other model alone", async () => {
    await storeFile(firstRef, "config.json");
    await storeFile(secondRef, "config.json");

    await removeStoredFiles(database, firstRef);

    const remaining = await database.getAllFromIndex(MODEL_FILE_STORE, "ref", secondRef);

    expect(remaining.map((file) => file.path)).toEqual(["config.json"]);
  });

  it("does nothing for a model that has no stored files", async () => {
    await expect(removeStoredFiles(database, firstRef)).resolves.toBeUndefined();
  });
});
