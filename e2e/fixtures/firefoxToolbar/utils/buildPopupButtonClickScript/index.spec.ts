import { describe, expect, it, vi } from "vitest";

import { buildPopupButtonClickScript } from ".";

/** Runs the script against a stand-in document holding `button`, or nothing. */
const run = (button: { click: () => void } | null, testId = "open-map"): unknown => {
  const selectors: string[] = [];
  const document = {
    querySelector: (selector: string) => {
      selectors.push(selector);
      return button;
    },
  };
  const result = JSON.parse(
    (new Function("document", buildPopupButtonClickScript(testId)) as (d: unknown) => string)(
      document,
    ),
  );

  return { result, selectors };
};

describe("buildPopupButtonClickScript", () => {
  it("clicks the button with the test id and says so", () => {
    const click = vi.fn();

    expect(run({ click })).toEqual({
      result: { clicked: true },
      selectors: ['[data-testid="open-map"]'],
    });
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("reports that nothing was clicked when the button is missing", () => {
    expect(run(null)).toMatchObject({ result: { clicked: false } });
  });

  it("embeds the test id as a string literal, so quotes cannot break out of it", () => {
    expect(buildPopupButtonClickScript(`a"b`)).toContain(JSON.stringify(`[data-testid="a"b"]`));
  });
});
