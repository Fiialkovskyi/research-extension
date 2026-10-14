import type { TimelineSegment } from "../buildTimeline";

/** Ticks one of these apart, whichever first leaves enough room between labels… */
const TICK_STEPS_MINUTES = [1, 5, 15, 30, 60, 120, 240] as const;
/** …or this far apart when none does. */
const WIDEST_TICK_STEP_MINUTES = 480;
/** The least room between two tick labels. */
const MINIMUM_TICK_SPACING = 72;

export interface TimeScaleOptions {
  segments: readonly TimelineSegment[];
  /** Horizontal pixels per minute of activity. */
  pixelsPerMinute: number;
  /** The width a break between segments takes. */
  breakWidth: number;
}

/** A time on the axis, and where it is drawn. */
export interface TimeTick {
  at: number;
  x: number;
}

/** Where a break between segments is drawn. */
export interface TimeBreak {
  x: number;
}

export interface TimeScale {
  /** The whole axis's width. */
  width: number;
  /** Where a time is drawn; a time in a pause sits at the break after the segment before it. */
  toX: (at: number) => number;
  ticks: TimeTick[];
  breaks: TimeBreak[];
}

/**
 * Builds the telemetry view's time axis: each segment to scale, at the chosen
 * pixels per minute, with a fixed-width break between segments, and ticks at
 * round times — the coarsest step that still leaves room for their labels.
 */
export const buildTimeScale = ({
  segments,
  pixelsPerMinute,
  breakWidth,
}: TimeScaleOptions): TimeScale => {
  const pixelsPerMs = pixelsPerMinute / 60_000;
  const offsets: number[] = [];
  let width = 0;

  segments.forEach((segment, index) => {
    if (index > 0) {
      width += breakWidth;
    }

    offsets.push(width);
    width += (segment.end - segment.start) * pixelsPerMs;
  });

  const toX = (at: number): number => {
    let x = 0;

    segments.forEach((segment, index) => {
      if (at >= segment.start) {
        x = (offsets[index] ?? 0) + (Math.min(at, segment.end) - segment.start) * pixelsPerMs;
      }
    });

    return x;
  };
  const stepMinutes =
    TICK_STEPS_MINUTES.find((step) => step * pixelsPerMinute >= MINIMUM_TICK_SPACING) ??
    WIDEST_TICK_STEP_MINUTES;
  const stepMs = stepMinutes * 60_000;
  const ticks = segments.flatMap((segment) => {
    const found: TimeTick[] = [];

    for (let at = Math.ceil(segment.start / stepMs) * stepMs; at <= segment.end; at += stepMs) {
      found.push({ at, x: toX(at) });
    }

    return found;
  });
  const breaks = offsets.slice(1).map((offset) => ({ x: offset - breakWidth / 2 }));

  return { width, toX, ticks, breaks };
};
