import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { readPageSourceDetails } from ".";
import {
  openResearchDatabase,
  PAGE_METADATA_STORE,
  type ResearchDatabaseSchema,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const NOW = Date.UTC(2026, 9, 26);

const put = (nodeId: string, fields: { siteName?: string; publishedAt?: string }) =>
  database.put(PAGE_METADATA_STORE, { nodeId, sessionId: "session-1", capturedAt: 1, ...fields });

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(PAGE_METADATA_STORE);
});

describe("readPageSourceDetails", () => {
  it("gives the site and the publication day of a page with both", async () => {
    await put("a", { siteName: "Bike Lab", publishedAt: "2026-05-01T08:00:00Z" });

    expect(await readPageSourceDetails(database, ["a"], NOW)).toEqual(
      new Map([
        [
          "a",
          {
            siteName: "Bike Lab",
            publishedDate: "2026-05-01",
            publishedTime: Date.UTC(2026, 4, 1, 8),
          },
        ],
      ]),
    );
  });

  it("gives only what a page has", async () => {
    await put("a", { siteName: "Bike Lab" });
    await put("b", { publishedAt: "2025-01-10" });

    const details = await readPageSourceDetails(database, ["a", "b"], NOW);

    expect(details.get("a")).toEqual({ siteName: "Bike Lab" });
    expect(details.get("b")).toEqual({
      publishedDate: "2025-01-10",
      publishedTime: Date.UTC(2025, 0, 10),
    });
  });

  it("gives no date for one that does not parse or is not plausible, but keeps the site", async () => {
    await put("a", { siteName: "Bike Lab", publishedAt: "last Tuesday" });
    await put("b", { siteName: "Old Site", publishedAt: "1985-01-01" });
    await put("c", { siteName: "Future Site", publishedAt: "2027-01-01" });

    const details = await readPageSourceDetails(database, ["a", "b", "c"], NOW);

    expect(details.get("a")).toEqual({ siteName: "Bike Lab" });
    expect(details.get("b")).toEqual({ siteName: "Old Site" });
    expect(details.get("c")).toEqual({ siteName: "Future Site" });
  });

  it("has no entry for a page without metadata, or with nothing usable in it", async () => {
    await put("a", { publishedAt: "last Tuesday" });

    const details = await readPageSourceDetails(database, ["a", "missing"], NOW);

    expect(details.size).toBe(0);
  });

  it("reads each page once, whatever it is listed", async () => {
    await put("a", { siteName: "Bike Lab" });

    expect((await readPageSourceDetails(database, ["a", "a", "a"], NOW)).size).toBe(1);
  });
});
