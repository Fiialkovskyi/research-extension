import { describe, expect, it } from "vitest";

import { isAiSetUp } from ".";
import type { StoredModel } from "@/shared/storage";

const model = (
  family: "embedding" | "text-generation",
  overrides: Partial<StoredModel> = {},
): StoredModel =>
  ({
    ref: `${family}@a`,
    manifest: { contract: { family } },
    active: true,
    conformance: "passed",
    diskBytes: 0,
    installedAt: 1,
    ...overrides,
  }) as StoredModel;

describe("isAiSetUp", () => {
  it("is not set up with no model", () => {
    expect(isAiSetUp([])).toBe(false);
  });

  it("is set up once an embedding model is active and passed its checks", () => {
    expect(isAiSetUp([model("embedding")])).toBe(true);
  });

  it("is set up while the generation model is still downloading", () => {
    expect(isAiSetUp([model("embedding"), model("text-generation", { active: false })])).toBe(true);
  });

  it("is not set up by a generation model alone", () => {
    expect(isAiSetUp([model("text-generation")])).toBe(false);
  });

  it.each([
    ["inactive", { active: false }],
    ["unchecked", { conformance: "pending" }],
    ["failed", { conformance: "failed" }],
  ] as const)("is not set up by an embedding model that is %s", (_, overrides) => {
    expect(isAiSetUp([model("embedding", overrides)])).toBe(false);
  });
});
