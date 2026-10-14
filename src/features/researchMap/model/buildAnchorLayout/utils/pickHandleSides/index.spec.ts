import { describe, expect, it } from "vitest";

import { pickHandleSides } from ".";

describe("pickHandleSides", () => {
  it("joins boxes side by side by their facing sides", () => {
    expect(pickHandleSides({ x: 0, y: 0 }, { x: 100, y: 20 })).toEqual({
      source: "right",
      target: "left",
    });
    expect(pickHandleSides({ x: 100, y: 0 }, { x: 0, y: 20 })).toEqual({
      source: "left",
      target: "right",
    });
  });

  it("joins boxes one above the other by top and bottom", () => {
    expect(pickHandleSides({ x: 0, y: 0 }, { x: 20, y: 100 })).toEqual({
      source: "bottom",
      target: "top",
    });
    expect(pickHandleSides({ x: 0, y: 100 }, { x: 20, y: 0 })).toEqual({
      source: "top",
      target: "bottom",
    });
  });
});
