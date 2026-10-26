import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readSummariesView } from ".";
import { encryptBytes, getDataKey } from "@/features/dataProtection";
import {
  CLUSTERING_STORE,
  ENTITY_STORE,
  FACT_STORE,
  JOB_STORE,
  MODEL_STORE,
  NODE_STORE,
  openResearchDatabase,
  PAGE_METADATA_STORE,
  REJECTION_STORE,
  SESSION_STORE,
  SUMMARY_STORE,
} from "@/shared/storage";

import { rejectFacts } from "@/features/factRejections";

import { buildSummaryMessages } from "../buildSummaryMessages";
import { getFactSetHash } from "../getFactSetHash";
import { readSummaryFacts } from "../readSummaryFacts";

const MODEL = "ollama:qwen3:4b@abc";

const seal = async (value: unknown) =>
  encryptBytes(
    await getDataKey(await openResearchDatabase()),
    new TextEncoder().encode(JSON.stringify(value)),
  );

const storeFact = async (id: string, nodeId: string, quote: string) => {
  const sealed = await seal({ subject: "Volta", attribute: "weight", value: "1", quote });

  await (
    await openResearchDatabase()
  ).put(FACT_STORE, {
    id,
    nodeId,
    sessionId: "s",
    keyId: sealed.keyId,
    iv: sealed.iv,
    provenance: { modelRef: "m", prompt: "p", chunkerVersion: "c", extractedAt: 1 },
    encryptedFact: sealed.ciphertext,
  } as never);
};

const storeSummary = async (factSetHash: string, modelRef = MODEL) => {
  const sealed = await seal([{ text: "Volta weighs 23.5 kg.", factIds: ["a:0:0", "gone:0:0"] }]);

  await (
    await openResearchDatabase()
  ).put(SUMMARY_STORE, {
    id: "s:bikes",
    sessionId: "s",
    clusterId: "bikes",
    factSetHash,
    citedFactIds: ["a:0:0"],
    inputFactCount: 1,
    omittedFactCount: 0,
    modelRef,
    prompt: "clusterSummary@1",
    generatedAt: 9,
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedStatements: sealed.ciphertext,
  });
};

/** Stores a summary of `statements` for the "bikes" cluster, whose fact is of a product named `product`. */
const storeStatementsAbout = async (product: string, statements: string[]) => {
  const database = await openResearchDatabase();
  const entity = await seal({ name: product, type: "product" });
  const fact = await database.get(FACT_STORE, "a:0:0");

  await database.put(ENTITY_STORE, {
    id: "product",
    sessionId: "s",
    isSeparated: false,
    createdAt: 1,
    keyId: entity.keyId,
    iv: entity.iv,
    encryptedEntity: entity.ciphertext,
  });
  await database.put(FACT_STORE, { ...(fact as NonNullable<typeof fact>), entityId: "product" });

  const sealed = await seal(statements.map((text) => ({ text, factIds: ["a:0:0"] })));

  await database.put(SUMMARY_STORE, {
    id: "s:bikes",
    sessionId: "s",
    clusterId: "bikes",
    factSetHash: await getFactSetHash(["a:0:0"]),
    citedFactIds: ["a:0:0"],
    inputFactCount: 1,
    omittedFactCount: 0,
    modelRef: MODEL,
    prompt: "clusterSummary@2",
    generatedAt: 9,
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedStatements: sealed.ciphertext,
  });
};

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all(
    (
      [
        CLUSTERING_STORE,
        ENTITY_STORE,
        FACT_STORE,
        JOB_STORE,
        MODEL_STORE,
        NODE_STORE,
        SESSION_STORE,
        SUMMARY_STORE,
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
  await database.put(NODE_STORE, {
    id: "a",
    sessionId: "s",
    title: "Volta review",
    url: "https://example.org/volta",
  } as never);
  await database.put(MODEL_STORE, {
    ref: MODEL,
    manifest: {
      reference: { repository: "qwen3:4b" },
      contract: { family: "text-generation" },
    },
    active: true,
    conformance: "passed",
    installedAt: 1,
  } as never);
  await database.put(CLUSTERING_STORE, {
    sessionId: "s",
    algorithmVersion: "a",
    configVersion: "c",
    computedAt: 1,
    clusters: [
      { id: "bikes", label: "E-bikes", memberIds: ["a"] },
      { id: "shops", label: "Shops", memberIds: ["x"] },
    ],
  });
  await storeFact("a:0:0", "a", "weighs 23.5 kg");
});

/** Three facts of one product: its price from the page's data, a weight and a battery. */
const storeProduct = async () => {
  const database = await openResearchDatabase();
  const entity = await seal({ name: "Pixel 10a", type: "product" });

  await database.put(ENTITY_STORE, {
    id: "pixel",
    sessionId: "s",
    isSeparated: false,
    createdAt: 1,
    keyId: entity.keyId,
    iv: entity.iv,
    encryptedEntity: entity.ciphertext,
  });

  for (const [id, attribute, value, unit, prompt] of [
    ["a:product:0", "price", "24399", "UAH", "productData@1"],
    ["a:0:1", "weight", "190", "g", "factExtraction@2"],
    ["a:0:2", "battery capacity", "5100", "mAh", "factExtraction@2"],
  ] as const) {
    const sealed = await seal({
      subject: "Pixel 10a",
      attribute,
      value,
      unit,
      quote: `${attribute} ${value}`,
    });

    await database.put(FACT_STORE, {
      id,
      nodeId: "a",
      sessionId: "s",
      entityId: "pixel",
      keyId: sealed.keyId,
      iv: sealed.iv,
      provenance: { modelRef: "m", prompt, chunkerVersion: "c", extractedAt: 1 },
      encryptedFact: sealed.ciphertext,
    } as never);
  }
};

const readTexts = async () =>
  (
    await readSummariesView(await openResearchDatabase(), "s")
  )?.clusters[0]?.summary?.statements.map(({ text }) => text);

describe("readSummariesView", () => {
  it("shows each cluster, its summary and its citations resolved to page and quote", async () => {
    await storeSummary(await getFactSetHash(["a:0:0"]));

    expect(await readSummariesView(await openResearchDatabase(), "s")).toEqual({
      title: "E-bikes",
      canSummarize: true,
      clusters: [
        {
          clusterId: "bikes",
          label: "E-bikes",
          factCount: 1,
          cards: [],
          omittedProductCount: 0,
          isPending: false,
          summary: {
            statements: [
              {
                text: "Volta weighs 23.5 kg.",
                citations: [
                  {
                    factId: "a:0:0",
                    pageTitle: "Volta review",
                    url: "https://example.org/volta",
                    quote: "weighs 23.5 kg",
                  },
                ],
              },
            ],
            isStale: false,
            omittedFactCount: 0,
            generatedAt: 9,
            modelName: "qwen3:4b",
          },
        },
        {
          clusterId: "shops",
          label: "Shops",
          factCount: 0,
          cards: [],
          omittedProductCount: 0,
          isPending: false,
          summary: null,
        },
      ],
    });
  });

  describe("what names a citation", () => {
    it("gives a citation its page's site and day, and leaves a page without them as it was", async () => {
      await storeSummary(await getFactSetHash(["a:0:0"]));

      const database = await openResearchDatabase();
      const citationOf = async () =>
        (await readSummariesView(database, "s"))?.clusters[0]?.summary?.statements[0]?.citations[0];

      expect(await citationOf()).not.toHaveProperty("siteName");
      expect(await citationOf()).not.toHaveProperty("publishedDate");

      await database.put(PAGE_METADATA_STORE, {
        nodeId: "a",
        sessionId: "s",
        capturedAt: 1,
        siteName: "Bike Lab",
        publishedAt: "2026-05-01T08:00:00Z",
      });

      expect(await citationOf()).toMatchObject({
        siteName: "Bike Lab",
        publishedDate: "2026-05-01",
      });
    });

    it("leaves a summary not stale, and what a model is given unchanged, when metadata arrives", async () => {
      await storeSummary(await getFactSetHash(["a:0:0"]));

      const database = await openResearchDatabase();
      const readMessages = async () =>
        buildSummaryMessages(
          await readSummaryFacts(database, await getDataKey(database), ["a:0:0"]),
        );
      const before = await readMessages();

      await database.put(PAGE_METADATA_STORE, {
        nodeId: "a",
        sessionId: "s",
        capturedAt: 1,
        siteName: "Bike Lab",
        publishedAt: "2026-05-01",
      });

      expect((await readSummariesView(database, "s"))?.clusters[0]?.summary?.isStale).toBe(false);
      expect(await readMessages()).toEqual(before);
    });
  });

  it("says a summary is stale once its cluster's facts changed", async () => {
    await storeSummary(await getFactSetHash(["a:0:0"]));
    await storeFact("a:0:1", "a", "another");

    expect(
      (await readSummariesView(await openResearchDatabase(), "s"))?.clusters[0]?.summary?.isStale,
    ).toBe(true);
  });

  it("says a summary is stale once its model is no longer installed", async () => {
    await storeSummary(await getFactSetHash(["a:0:0"]), "ollama:removed@1");

    expect(
      (await readSummariesView(await openResearchDatabase(), "s"))?.clusters[0]?.summary?.isStale,
    ).toBe(true);
  });

  it("drops a rejected fact's citation and shows its summary stale", async () => {
    const database = await openResearchDatabase();

    await storeSummary(await getFactSetHash(["a:0:0"]));
    await rejectFacts(database, ["a:0:0"]);

    const [bikes] = (await readSummariesView(database, "s"))?.clusters ?? [];

    expect(bikes?.factCount).toBe(0);
    expect(bikes?.summary).toMatchObject({
      isStale: true,
      statements: [{ text: "Volta weighs 23.5 kg.", citations: [] }],
    });
  });

  it("shows a requested summary as pending", async () => {
    await (
      await openResearchDatabase()
    ).put(JOB_STORE, {
      id: "j",
      type: "summarizeCluster",
      sessionId: "s",
      status: "queued",
      payload: { clusterId: "bikes", factSetHash: "h", requestedAt: 1 },
    } as never);

    expect(
      (await readSummariesView(await openResearchDatabase(), "s"))?.clusters[0]?.isPending,
    ).toBe(true);
  });

  it("shows nothing without a live session", async () => {
    await (await openResearchDatabase()).clear(SESSION_STORE);

    expect(await readSummariesView(await openResearchDatabase(), "s")).toBeUndefined();
  });

  describe("product cards", () => {
    it("makes a card of a product's facts: name, price from the page's data and key specs, each with its page", async () => {
      await storeProduct();

      const [bikes] = (await readSummariesView(await openResearchDatabase(), "s"))?.clusters ?? [];

      expect(bikes?.cards).toHaveLength(1);
      expect(bikes?.cards[0]).toMatchObject({
        name: "Pixel 10a",
        price: { value: "24399 UAH", citations: [{ url: "https://example.org/volta" }] },
        specs: [
          { label: "weight", value: "190 g" },
          { label: "battery capacity", value: "5100 mAh" },
        ],
      });
    });

    it("makes no card once a fact is marked wrong that leaves the product with too few", async () => {
      await storeProduct();

      const database = await openResearchDatabase();

      await rejectFacts(database, ["a:0:1"]);

      expect((await readSummariesView(database, "s"))?.clusters[0]?.cards).toEqual([]);
    });
  });

  describe("statements that name a product", () => {
    it("leaves out a statement that names none of the products when another names one", async () => {
      await storeStatementsAbout("iPhone 17", [
        "iPhone 17 costs 45 999 UAH.",
        "The device supports video playback.",
      ]);

      expect(await readTexts()).toEqual(["iPhone 17 costs 45 999 UAH."]);
    });

    it("shows every statement when none names a product", async () => {
      await storeStatementsAbout("iPhone 17", [
        "The device supports video playback.",
        "It is OLED.",
      ]);

      expect(await readTexts()).toEqual(["The device supports video playback.", "It is OLED."]);
    });

    it("counts a statement that spells the name differently, and changes nothing stored", async () => {
      await storeStatementsAbout("iPhone 17", ["IPHONE-17 is OLED.", "Nothing here."]);

      expect(await readTexts()).toEqual(["IPHONE-17 is OLED."]);
      expect((await (await openResearchDatabase()).get(SUMMARY_STORE, "s:bikes"))?.prompt).toBe(
        "clusterSummary@2",
      );
    });
  });
});
