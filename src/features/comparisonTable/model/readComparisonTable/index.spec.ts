import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readComparisonTable } from ".";
import { encryptBytes, getDataKey } from "@/features/dataProtection";
import {
  ENTITY_STORE,
  FACT_STORE,
  NODE_STORE,
  openResearchDatabase,
  PAGE_METADATA_STORE,
  REJECTION_STORE,
  SESSION_STORE,
  TABLE_COLUMNS_STORE,
} from "@/shared/storage";

import { rejectFacts } from "@/features/factRejections";

import { saveTableColumns } from "../saveTableColumns";

const seal = async (value: unknown) =>
  encryptBytes(
    await getDataKey(await openResearchDatabase()),
    new TextEncoder().encode(JSON.stringify(value)),
  );

const storeEntity = async (id: string, name: string, type: string, mergedInto?: string) => {
  const sealed = await seal({ name, type });

  await (
    await openResearchDatabase()
  ).put(ENTITY_STORE, {
    id,
    sessionId: "s",
    isSeparated: false,
    ...(mergedInto === undefined ? {} : { mergedInto }),
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedEntity: sealed.ciphertext,
    createdAt: 1,
  });
};

let count = 0;

const storeFact = async (
  entityId: string | undefined,
  nodeId: string,
  attribute: string,
  value: string,
  unit?: string,
) => {
  count += 1;

  const sealed = await seal({
    subject: "s",
    attribute,
    value,
    ...(unit === undefined ? {} : { unit }),
    quote: `${attribute} ${value}`,
  });

  await (
    await openResearchDatabase()
  ).put(FACT_STORE, {
    id: `${nodeId}:0:${count}`,
    sessionId: "s",
    nodeId,
    ...(entityId === undefined ? {} : { entityId }),
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedFact: sealed.ciphertext,
  } as never);
};

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all(
    (
      [
        ENTITY_STORE,
        FACT_STORE,
        NODE_STORE,
        SESSION_STORE,
        TABLE_COLUMNS_STORE,
        REJECTION_STORE,
        PAGE_METADATA_STORE,
      ] as const
    ).map((store) => database.clear(store)),
  );
  await database.put(SESSION_STORE, {
    id: "s",
    title: "E-bikes",
    groupId: 1,
    formerGroupIds: [],
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });

  for (const [id, url] of [
    ["review", "https://example.org/review"],
    ["shop", "https://shop.example/volta"],
  ] as const) {
    await database.put(NODE_STORE, { id, sessionId: "s", title: id, url } as never);
  }

  await storeEntity("volta", "Volta E5", "product");
  await storeEntity("volta-shop", "Volta E5 2026", "product", "volta");
  await storeEntity("corsa", "Corsa", "product");
  await storeEntity("acme", "Acme", "company");
  await storeFact("volta", "review", "weight", "23.5", "kg");
  await storeFact("volta-shop", "shop", "Weight", "23 500", "g");
  await storeFact("volta", "review", "price", "1749", "USD");
  await storeFact("volta-shop", "shop", "price", "1999", "USD");
  await storeFact("corsa", "review", "weight", "19.8", "kg");
  await storeFact("corsa", "review", "price", "1500", "USD");
  await storeFact("acme", "review", "founded", "1999");
  await storeFact(undefined, "review", "weight", "99", "kg");
});

describe("readComparisonTable", () => {
  it("lists the commonest type's entities, merged ones as one row, with their cells", async () => {
    const view = await readComparisonTable(await openResearchDatabase(), "s");

    expect(view?.title).toBe("E-bikes");
    expect(view?.table.types).toEqual([
      { type: "product", rowCount: 2 },
      { type: "company", rowCount: 1 },
    ]);
    expect(view?.table.entityType).toBe("product");
    expect(view?.table.columns.map(({ key }) => key)).toEqual(["price", "weight"]);
    expect(view?.table.rows.map(({ name }) => name)).toEqual(["Volta E5", "Corsa"]);

    const [volta] = view?.table.rows ?? [];

    expect(volta?.cells["weight"]).toMatchObject({ value: "23.5 kg", isConflict: false });
    expect(volta?.cells["price"]).toMatchObject({ isConflict: true, alternativeCount: 1 });
    expect(volta?.cells["price"]?.groups.map(({ sources }) => sources[0]?.url)).toEqual([
      "https://example.org/review",
      "https://shop.example/volta",
    ]);
  });

  describe("what names a source", () => {
    it("gives each source its page's site and publication day, and marks the newest in a conflict", async () => {
      const database = await openResearchDatabase();

      await database.put(PAGE_METADATA_STORE, {
        nodeId: "review",
        sessionId: "s",
        capturedAt: 1,
        siteName: "Bike Lab",
        publishedAt: "2025-01-10",
      });
      await database.put(PAGE_METADATA_STORE, {
        nodeId: "shop",
        sessionId: "s",
        capturedAt: 1,
        siteName: "Volta Shop",
        publishedAt: "2026-05-01T08:00:00Z",
      });

      const price = (await readComparisonTable(database, "s"))?.table.rows[0]?.cells["price"];

      expect(price?.groups.map(({ sources }) => sources[0])).toEqual([
        expect.objectContaining({ siteName: "Bike Lab", publishedDate: "2025-01-10" }),
        expect.objectContaining({ siteName: "Volta Shop", publishedDate: "2026-05-01" }),
      ]);
      expect(price?.groups.map(({ isNewest }) => isNewest)).toEqual([undefined, true]);
      expect(price).toMatchObject({ isConflict: true, alternativeCount: 1 });
    });

    it("shows a source without metadata as before", async () => {
      const price = (await readComparisonTable(await openResearchDatabase(), "s"))?.table.rows[0]
        ?.cells["price"];

      expect(price?.groups[0]?.sources[0]).toEqual({
        factId: expect.any(String),
        pageTitle: "review",
        url: "https://example.org/review",
        quote: "price 1749",
      });
      expect(price?.groups.some(({ isNewest }) => isNewest === true)).toBe(false);
    });
  });

  it("leaves out a rejected value, which ends the cell's conflict, and counts rejections", async () => {
    const database = await openResearchDatabase();
    // The shop page's facts are its weight, then its price.
    const [, shopPrice] = (await database.getAllFromIndex(FACT_STORE, "nodeId", "shop")).toSorted(
      (a, b) => Number(a.id.split(":")[2]) - Number(b.id.split(":")[2]),
    );

    await rejectFacts(database, [shopPrice!.id]);

    const view = await readComparisonTable(database, "s");

    expect(view?.table.rows[0]?.cells["price"]).toMatchObject({
      value: "1749 USD",
      isConflict: false,
    });
    expect(view?.table.rejectedCount).toBe(1);
  });

  it("leaves out a record that fails to decrypt, rather than failing", async () => {
    const database = await openResearchDatabase();

    await database.put(FACT_STORE, {
      id: "review:0:999",
      sessionId: "s",
      nodeId: "review",
      entityId: "volta",
      keyId: "k",
      iv: new Uint8Array(12),
      encryptedFact: new ArrayBuffer(32),
    } as never);

    expect((await readComparisonTable(database, "s"))?.table.rows.map(({ name }) => name)).toEqual([
      "Volta E5",
      "Corsa",
    ]);
  });

  it("shows another type when asked", async () => {
    const view = await readComparisonTable(await openResearchDatabase(), "s", "Company");

    expect(view?.table.entityType).toBe("company");
    expect(view?.table.rows.map(({ name }) => name)).toEqual(["Acme"]);
  });

  it("uses the columns the user saved, and offers the rest", async () => {
    const database = await openResearchDatabase();

    await saveTableColumns(database, "s", "product", ["price"]);

    const view = await readComparisonTable(database, "s");

    expect(view?.table.columns.map(({ key }) => key)).toEqual(["price"]);
    expect(view?.table.otherColumns.map(({ key }) => key)).toEqual(["weight"]);
    expect(JSON.stringify(await database.getAll(TABLE_COLUMNS_STORE))).not.toContain("price");
  });

  it("returns to the proposed columns when the choice is cleared", async () => {
    const database = await openResearchDatabase();

    await saveTableColumns(database, "s", "product", ["price"]);
    await saveTableColumns(database, "s", "product", []);

    expect(await database.count(TABLE_COLUMNS_STORE)).toBe(0);
    expect((await readComparisonTable(database, "s"))?.table.columns).toHaveLength(2);
  });

  it("gives an empty table without resolved facts, and nothing without a session", async () => {
    const database = await openResearchDatabase();

    await database.clear(ENTITY_STORE);
    await database.clear(FACT_STORE);

    expect((await readComparisonTable(database, "s"))?.table).toMatchObject({
      entityType: null,
      rows: [],
    });

    await database.clear(SESSION_STORE);

    expect(await readComparisonTable(database, "s")).toBeUndefined();
  });

  it("gives attributes that name one thing in two languages one column", async () => {
    await storeFact("volta", "review", "діафрагма", "f/1.8");
    await storeFact("corsa", "shop", "aperture", "f/2.0");

    const view = await readComparisonTable(await openResearchDatabase(), "s");
    const apertures = view?.table.columns.filter(({ key }) => key === "aperture") ?? [];

    expect(apertures).toHaveLength(1);
    expect(view?.table.rows.every(({ cells }) => cells["aperture"] !== undefined)).toBe(true);
  });
});
