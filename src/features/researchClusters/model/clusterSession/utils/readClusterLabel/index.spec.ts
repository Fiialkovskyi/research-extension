import { describe, expect, it } from "vitest";

import { readClusterLabel } from ".";
import type { StoredNode } from "@/shared/storage";

const node = (overrides: Partial<StoredNode>) =>
  ({ kind: "page", title: "", url: "https://example.org/x", ...overrides }) as StoredNode;

describe("readClusterLabel", () => {
  it("names a cluster by its earliest search", () => {
    expect(
      readClusterLabel([
        node({ title: "Mid-drive motors" }),
        node({ kind: "serp", query: "e-bike motors" }),
        node({ kind: "serp", query: "hub motors" }),
      ]),
    ).toBe("e-bike motors");
  });

  it("falls back to the earliest page's title, then its URL", () => {
    expect(readClusterLabel([node({ title: "Mid-drive motors" }), node({ title: "B" })])).toBe(
      "Mid-drive motors",
    );
    expect(readClusterLabel([node({ title: "  " })])).toBe("https://example.org/x");
  });

  it("names a cluster after the entity its pages state most facts about", () => {
    const members = [node({ id: "a", title: "Page A" }), node({ id: "b", title: "Page B" })];

    expect(
      readClusterLabel(members, [
        {
          name: "Pixel 10a",
          factCount: 9,
          pages: [
            { nodeId: "a", factCount: 4 },
            { nodeId: "b", factCount: 3 },
          ],
        },
        { name: "Other", factCount: 9, pages: [{ nodeId: "z", factCount: 9 }] },
      ]),
    ).toBe("Pixel 10a");
  });

  it("falls back when no entity has three facts on the cluster's pages", () => {
    expect(
      readClusterLabel(
        [node({ id: "a", title: "Page A" })],
        [{ name: "Pixel", factCount: 9, pages: [{ nodeId: "a", factCount: 2 }] }],
      ),
    ).toBe("Page A");
  });
});
