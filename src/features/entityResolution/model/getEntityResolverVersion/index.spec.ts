import { describe, expect, it } from "vitest";

import { getEntityResolverVersion } from ".";

describe("getEntityResolverVersion", () => {
  it("names the name rules and the embedding model, or none", () => {
    expect(getEntityResolverVersion("ollama:nomic@1")).toBe("entityName@1|ollama:nomic@1");
    expect(getEntityResolverVersion(undefined)).toBe("entityName@1|none");
  });
});
