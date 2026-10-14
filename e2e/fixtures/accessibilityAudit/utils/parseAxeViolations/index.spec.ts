import { describe, expect, it } from "vitest";

import { parseAxeViolations } from ".";

describe("parseAxeViolations", () => {
  it("reads the violations", () => {
    const raw = JSON.stringify([
      { id: "label", impact: "critical", help: "Form elements must have labels", targets: ["#a"] },
    ]);

    expect(parseAxeViolations(raw)).toEqual([
      { id: "label", impact: "critical", help: "Form elements must have labels", targets: ["#a"] },
    ]);
  });

  it("refuses anything but a JSON string of violations", () => {
    expect(() => parseAxeViolations(undefined)).toThrow("JSON string");
    expect(() => parseAxeViolations('[{"id":1}]')).toThrow();
  });
});
