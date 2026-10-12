import { describe, expect, it } from "vitest";

import { listUnreadPages } from ".";
import type { MapNode } from "@/features/researchMap";

const buildNode = (id: string, overrides: Partial<MapNode>): MapNode =>
  ({ id, engagement: "unread", tabState: "open", createdAt: 0, ...overrides }) as MapNode;

describe("listUnreadPages", () => {
  it("lists open unread pages, oldest first", () => {
    expect(
      listUnreadPages([
        buildNode("d", { createdAt: 3 }),
        buildNode("c", { createdAt: 2 }),
        buildNode("read", { engagement: "skimmed", createdAt: 1 }),
        buildNode("gone", { tabState: "closed", createdAt: 0 }),
      ]).map(({ id }) => id),
    ).toEqual(["c", "d"]);
  });

  it("lists nothing when everything was looked at", () => {
    expect(listUnreadPages([buildNode("a", { engagement: "deep_read" })])).toEqual([]);
  });
});
