import { describe, expect, it, vi } from "vitest";

import { buildPopupSessionSelectScript } from ".";

/** Runs the script against a stand-in select holding `options`, or nothing. */
const run = (options: { value: string; textContent: string }[] | null, label = "Motors") => {
  const dispatchEvent = vi.fn();
  const set = vi.fn();
  const select = options === null ? null : { options, dispatchEvent };
  const document = { querySelector: () => select };
  const HTMLSelectElement = {
    prototype: Object.defineProperty({}, "value", { set, configurable: true }),
  };
  const result = JSON.parse(
    (
      new Function(
        "document",
        "HTMLSelectElement",
        "Event",
        buildPopupSessionSelectScript(label),
      ) as (d: unknown, h: unknown, e: unknown) => string
    )(document, HTMLSelectElement, function Event() {}),
  );

  return { result, set, dispatchEvent };
};

describe("buildPopupSessionSelectScript", () => {
  it("chooses the option naming the session and announces the change", () => {
    const { result, set, dispatchEvent } = run([
      { value: "", textContent: "Saved sessions (2)" },
      { value: "a", textContent: "E-bike Motors · 2 pages" },
    ]);

    expect(result).toEqual({ selected: true });
    expect(set).toHaveBeenCalledWith("a");
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it("reports that nothing was chosen when no option names the session", () => {
    expect(run([{ value: "", textContent: "Saved sessions (1)" }]).result).toEqual({
      selected: false,
    });
  });

  it("reports that nothing was chosen when the popup has no select", () => {
    expect(run(null).result).toEqual({ selected: false });
  });
});
