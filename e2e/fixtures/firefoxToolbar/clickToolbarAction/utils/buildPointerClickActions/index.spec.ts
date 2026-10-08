import { describe, expect, it } from "vitest";

import { buildPointerClickActions } from "./index";
import { ELEMENT_KEY } from "../../../constants";

describe("buildPointerClickActions", () => {
  it("presses and releases over the element, in that order", () => {
    const [sequence] = buildPointerClickActions("element-1");

    expect(sequence?.actions.map((action) => action.type)).toEqual([
      "pointerMove",
      "pointerDown",
      "pointerUp",
    ]);
  });

  it("uses the primary button", () => {
    const [sequence] = buildPointerClickActions("element-1");

    expect(sequence?.actions.every((action) => !("button" in action) || action.button === 0)).toBe(
      true,
    );
  });

  it("anchors the move on the element, using the protocol's reference key", () => {
    const [sequence] = buildPointerClickActions("element-1");
    const [move] = sequence?.actions ?? [];

    expect(move).toMatchObject({ origin: { [ELEMENT_KEY]: "element-1" }, x: 0, y: 0 });
  });

  it("describes a mouse, not a touch or pen", () => {
    expect(buildPointerClickActions("element-1")[0]?.parameters.pointerType).toBe("mouse");
  });
});
