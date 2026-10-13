import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { rejectFacts } from ".";
import { encryptBytes, getDataKey } from "@/features/dataProtection";
import { FACT_STORE, openResearchDatabase, REJECTION_STORE } from "@/shared/storage";

import { filterRejectedFacts } from "../filterRejectedFacts";
import { readRejectedKeys } from "../readRejectedKeys";
import { restoreRejections } from "../restoreRejections";

const storeFact = async (id: string, value: string, unit: string) => {
  const database = await openResearchDatabase();
  const sealed = await encryptBytes(
    await getDataKey(database),
    new TextEncoder().encode(
      JSON.stringify({ subject: "Volta", attribute: "weight", value, unit, quote: "q" }),
    ),
  );

  await database.put(FACT_STORE, {
    id,
    sessionId: "s",
    nodeId: "n",
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedFact: sealed.ciphertext,
  } as never);
};

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all([database.clear(FACT_STORE), database.clear(REJECTION_STORE)]);
  await storeFact("a", "2.6", "kg");
  await storeFact("b", "2 600", "g");
  await storeFact("c", "23.5", "kg");
});

describe("rejecting and restoring facts", () => {
  it("stores one rejection per key, without readable content", async () => {
    const database = await openResearchDatabase();

    expect(await rejectFacts(database, ["a", "b", "missing"], 7)).toBe(1);

    const [rejection] = await database.getAll(REJECTION_STORE);

    expect(rejection).toMatchObject({ sessionId: "s", createdAt: 7 });
    expect(JSON.stringify(rejection)).not.toMatch(/2\.6|weight|Volta/u);
  });

  it("filters out every fact with a rejected key, and only those", async () => {
    const database = await openResearchDatabase();
    const facts = [
      { id: "a", subject: "Volta", attribute: "weight", value: "2.6", unit: "kg" },
      { id: "b", subject: "volta", attribute: "Weight", value: "2600", unit: "g" },
      { id: "c", subject: "Volta", attribute: "weight", value: "23.5", unit: "kg" },
    ];

    await rejectFacts(database, ["a"]);

    expect(
      (await filterRejectedFacts(facts, await readRejectedKeys(database, "s"))).map(({ id }) => id),
    ).toEqual(["c"]);
  });

  it("restores a session's rejections", async () => {
    const database = await openResearchDatabase();

    await rejectFacts(database, ["a", "c"]);

    expect(await restoreRejections(database, "s")).toBe(2);
    expect((await readRejectedKeys(database, "s")).size).toBe(0);
  });
});
