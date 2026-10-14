/** A side of a node box an edge may leave or enter by. */
export type HandleSide = "top" | "right" | "bottom" | "left";

/** A point: a node box's centre. */
export interface Point {
  x: number;
  y: number;
}

/**
 * Picks the sides two boxes face each other by, so an edge between pages laid
 * out in a ring leaves and enters on the near sides rather than looping round
 * to the top and bottom.
 */
export const pickHandleSides = (
  from: Point,
  to: Point,
): { source: HandleSide; target: HandleSide } => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? { source: "right", target: "left" } : { source: "left", target: "right" };
  }

  return dy > 0 ? { source: "bottom", target: "top" } : { source: "top", target: "bottom" };
};
