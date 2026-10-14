import { describe, expect, it } from "vitest";

import { selectAnchors } from ".";

const page = (
  id: string,
  overrides: Partial<Parameters<typeof selectAnchors>[0][number]> = {},
) => ({
  id,
  revisitCount: 0,
  copyEvents: 0,
  pasteEvents: 0,
  activeDwellMs: 0,
  ...overrides,
});

describe("selectAnchors", () => {
  it("makes a page returned to twice an anchor, and not one returned to once", () => {
    expect(selectAnchors([page("a", { revisitCount: 2 }), page("b", { revisitCount: 1 })])).toEqual(
      new Set(["a"]),
    );
  });

  it("counts copies and pastes together", () => {
    expect(
      selectAnchors([
        page("a", { copyEvents: 1, pasteEvents: 1 }),
        page("b", { copyEvents: 1 }),
        page("c", { pasteEvents: 2 }),
      ]),
    ).toEqual(new Set(["a", "c"]));
  });

  it("makes a page read for three minutes an anchor, and not one read for less", () => {
    expect(
      selectAnchors([page("a", { activeDwellMs: 180_000 }), page("b", { activeDwellMs: 179_999 })]),
    ).toEqual(new Set(["a"]));
  });

  it("finds no anchors in a session nobody dwelt in", () => {
    expect(selectAnchors([page("a"), page("b")]).size).toBe(0);
  });
});
