import { describe, expect, it } from "vitest";

import { buildTimeScale } from ".";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("buildTimeScale", () => {
  it("draws a segment to scale", () => {
    const scale = buildTimeScale({
      segments: [{ start: 0, end: 10 * MINUTE }],
      pixelsPerMinute: 4,
      breakWidth: 24,
    });

    expect(scale.width).toBe(40);
    expect(scale.toX(5 * MINUTE)).toBe(20);
  });

  it("puts a fixed break between segments, however long the pause", () => {
    const scale = buildTimeScale({
      segments: [
        { start: 0, end: 10 * MINUTE },
        { start: 9 * HOUR, end: 9 * HOUR + 10 * MINUTE },
      ],
      pixelsPerMinute: 4,
      breakWidth: 24,
    });

    expect(scale.width).toBe(40 + 24 + 40);
    expect(scale.toX(9 * HOUR)).toBe(64);
    expect(scale.toX(5 * HOUR)).toBe(40);
    expect(scale.breaks).toEqual([{ x: 52 }]);
  });

  it("ticks at the finest round step that leaves room for a label", () => {
    const coarse = buildTimeScale({
      segments: [{ start: 0, end: 3 * HOUR }],
      pixelsPerMinute: 2,
      breakWidth: 24,
    });
    const fine = buildTimeScale({
      segments: [{ start: 0, end: HOUR }],
      pixelsPerMinute: 20,
      breakWidth: 24,
    });

    expect(coarse.ticks.map(({ at }) => at / MINUTE)).toEqual([0, 60, 120, 180]);
    expect(fine.ticks.map(({ at }) => at / MINUTE)).toEqual([
      0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60,
    ]);
  });
});
