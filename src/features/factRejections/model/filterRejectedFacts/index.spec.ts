import { describe, expect, it } from "vitest";

import { filterRejectedFacts } from ".";
import { getFactKey } from "../getFactKey";

const FACT = { id: "a", subject: "Volta", attribute: "weight", value: "2.6", unit: "kg" };

describe("filterRejectedFacts", () => {
  it("keeps every fact when nothing is rejected", async () => {
    expect(await filterRejectedFacts([FACT], new Set())).toEqual([FACT]);
  });

  it("leaves out a fact whose key is rejected", async () => {
    expect(await filterRejectedFacts([FACT], new Set([await getFactKey(FACT)]))).toEqual([]);
  });
});
