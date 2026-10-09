import { describe, expect, it } from "vitest";

import { buildGroupTitleSubmitScript } from ".";

describe("buildGroupTitleSubmitScript", () => {
  it("embeds the title as a string literal, so quotes cannot break out of it", () => {
    const script = buildGroupTitleSubmitScript(`a "quoted" title`);

    expect(script).toContain(JSON.stringify(`a "quoted" title`));
  });

  it("announces the value with an input event before submitting", () => {
    const script = buildGroupTitleSubmitScript("Motors");

    expect(script.indexOf('new Event("input"')).toBeLessThan(script.indexOf("requestSubmit"));
  });

  it("reports that nothing was submitted when the form is missing", () => {
    const script = buildGroupTitleSubmitScript("Motors");
    const run = new Function("document", "HTMLInputElement", script) as (
      document: Pick<Document, "querySelector">,
      input: unknown,
    ) => string;

    expect(JSON.parse(run({ querySelector: () => null }, {}))).toEqual({ submitted: false });
  });
});
