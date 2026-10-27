import { describe, expect, it } from "vitest";

import type { ExtractedFact } from "../../types";
import { tidyFacts } from ".";

const fact = (overrides: Partial<ExtractedFact>): ExtractedFact => ({
  subject: "Pixel 10a",
  attribute: "Weight",
  concept: "weight",
  value: "184",
  quote: "Weight 184",
  ...overrides,
});

describe("tidyFacts", () => {
  it("drops a fact whose value is another fact's attribute, or a feature named with no value", () => {
    const result = tidyFacts(
      [
        fact({ attribute: "Always-On display", value: "Always-On display" }),
        fact({ attribute: "SIM format", value: "Connection type" }),
        fact({ attribute: "Connection type", value: "3G; 4G; 5G" }),
      ],
      undefined,
    );

    expect(result.facts.map(({ attribute }) => attribute)).toEqual(["Connection type"]);
    expect(result.droppedCount).toBe(2);
  });

  it("gives a bare value the model took for its label the concept as its attribute", () => {
    const [tidied] = tidyFacts(
      [fact({ attribute: "S10", concept: "processor model", value: "S10" })],
      undefined,
    ).facts;

    expect(tidied).toMatchObject({ attribute: "processor model", value: "S10" });
  });

  it("keeps a unit once, and the quote as it was", () => {
    const [tidied] = tidyFacts(
      [fact({ value: "184 g", unit: "g", quote: "Weight 184 g" })],
      undefined,
    ).facts;

    expect(tidied).toMatchObject({ value: "184", unit: "g", quote: "Weight 184 g" });
  });

  it("repairs a garbled subject with the page's product name", () => {
    const name = "Google Pixel 10 Pro 16/256GB (Porcelain)";
    const [tidied] = tidyFacts(
      [fact({ subject: "Google Pixel 1: 10 Pro 16/256GB (Porcelain)" })],
      name,
    ).facts;

    expect(tidied?.subject).toBe(name);
  });

  it("leaves a clean fact as it was", () => {
    const clean = fact({ unit: "g" });

    expect(tidyFacts([clean], "Pixel 10a")).toEqual({ facts: [clean], droppedCount: 0 });
  });
});
