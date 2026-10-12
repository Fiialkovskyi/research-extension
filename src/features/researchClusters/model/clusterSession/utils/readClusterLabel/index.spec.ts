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
});
