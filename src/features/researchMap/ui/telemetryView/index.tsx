import { useEffect, useMemo, useRef, useState } from "react";

import { type ClusterSlot, buildTimeline } from "../../model/buildTimeline";
import { buildTimeScale } from "../../model/buildTimeScale";
import { formatDuration } from "../../model/formatDuration";
import type { GraphSnapshot } from "../../types";

export interface TelemetryViewProps {
  snapshot: GraphSnapshot;
  /**
   * The captured text of pages asked for so far: a string, `null` when the page
   * has none, absent while it has not been asked for.
   */
  excerpts: Readonly<Record<string, string | null>>;
  /** Asks for a page's captured text, to show when its block is hovered; asking twice is harmless. */
  onReadExcerpt: (nodeId: string) => void;
  /** Called with the tab of an open page the user activated. */
  onFocusTab: (tabId: number) => void;
}

/** Room left and right of the strip. */
const PADDING_X = 32;
/** Height of the band the rotated cluster labels stand in. */
const LABEL_BAND = 120;
/** Where the blocks stand. */
const BASELINE = LABEL_BAND + 84;
/** Block heights: the shortest interval's, and the longest's. */
const BLOCK_HEIGHT = { minimum: 24, maximum: 76 };
/** An interval this long or longer is drawn at the tallest. */
const TALLEST_AFTER_MS = 20 * 60_000;
/** The width a pause between segments is drawn at. */
const BREAK_WIDTH = 28;
/** The least room a run needs for its label to be drawn above it. */
const LABEL_MINIMUM_WIDTH = 14;
const HEIGHT = BASELINE + 64;
/** Zoom steps, as multiples of the width that fits the whole session. */
const ZOOMS = [1, 2, 4, 8, 16, 32] as const;

/** The fill a cluster slot takes, from the variables the view's root declares. */
const readSlotFill = (slot: ClusterSlot): string => {
  if (slot === null) {
    return "var(--cluster-none)";
  }

  return slot === "other" ? "var(--cluster-other)" : `var(--cluster-${slot + 1})`;
};

/** How tall an interval's block stands: taller the longer it lasted, up to a cap. */
const readBlockHeight = (start: number, end: number): number =>
  BLOCK_HEIGHT.minimum +
  (BLOCK_HEIGHT.maximum - BLOCK_HEIGHT.minimum) *
    Math.min(1, Math.sqrt((end - start) / TALLEST_AFTER_MS));

/** A time of day as the axis and tooltip write it. */
const formatClock = (at: number): string =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * The telemetry view: the session as a strip of reading intervals in time,
 * each coloured by its page's cluster and taller the longer it lasted, the
 * clusters named above the strip, copies (●) and pastes (■) marked under it,
 * and long pauses drawn as breaks.
 *
 * Hovering or focusing a block shows the page, its cluster, when and how long,
 * and the start of its captured text, asked for the first time it is needed.
 * Activating the block of an open page selects its tab.
 *
 * Colours are the categorical palette's, one step per theme, and a cluster's
 * colour follows the cluster (see `buildTimeline`). Identity is never colour
 * alone: every run is labelled and the legend names each colour.
 */
export function TelemetryView({
  snapshot,
  excerpts,
  onReadExcerpt,
  onFocusTab,
}: TelemetryViewProps) {
  const timeline = useMemo(() => buildTimeline(snapshot), [snapshot]);
  const nodes = useMemo(
    () => new Map(snapshot.nodes.map((node) => [node.id, node])),
    [snapshot.nodes],
  );
  const container = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(960);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [hovered, setHovered] = useState<{ index: number; x: number; y: number } | undefined>();

  useEffect(() => {
    const element = container.current;

    if (element === null || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined && entry.contentRect.width > 0) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const activeMinutes = timeline.segments.reduce(
    (total, { start, end }) => total + (end - start) / 60_000,
    0,
  );
  const fitWidth =
    containerWidth - 2 * PADDING_X - BREAK_WIDTH * Math.max(0, timeline.segments.length - 1);
  const pixelsPerMinute =
    Math.max(0.05, fitWidth / Math.max(1, activeMinutes)) * (ZOOMS[zoomIndex] ?? 1);
  const scale = useMemo(
    () => buildTimeScale({ segments: timeline.segments, pixelsPerMinute, breakWidth: BREAK_WIDTH }),
    [timeline.segments, pixelsPerMinute],
  );

  if (timeline.blocks.length === 0) {
    return (
      <div data-testid="map-telemetry" className="p-4">
        <p data-testid="map-telemetry-empty" className="text-sm">
          No reading time was logged for this session yet. It is logged from now on, as you read.
        </p>
      </div>
    );
  }

  const show = (index: number, x: number, y: number) => {
    const block = timeline.blocks[index];

    setHovered({ index, x, y });

    if (block !== undefined && excerpts[block.nodeId] === undefined) {
      onReadExcerpt(block.nodeId);
    }
  };
  const activate = (nodeId: string) => {
    const node = nodes.get(nodeId);

    if (node?.tabState === "open") {
      onFocusTab(node.tabId);
    }
  };
  const hoveredBlock = hovered === undefined ? undefined : timeline.blocks[hovered.index];
  const hoveredNode = hoveredBlock === undefined ? undefined : nodes.get(hoveredBlock.nodeId);
  const hoveredRun = timeline.runs.find(
    (run) =>
      hoveredBlock !== undefined &&
      run.slot === hoveredBlock.slot &&
      run.start <= hoveredBlock.start &&
      hoveredBlock.end <= run.end,
  );
  const excerpt = hoveredBlock === undefined ? undefined : excerpts[hoveredBlock.nodeId];

  return (
    <div
      data-testid="map-telemetry"
      className="flex h-full flex-col gap-3 p-4 [--cluster-1:#2a78d6] [--cluster-2:#eb6834] [--cluster-3:#1baf7a] [--cluster-4:#eda100] [--cluster-5:#e87ba4] [--cluster-6:#008300] [--cluster-7:#6250d6] [--cluster-8:#e34948] [--cluster-none:#b5b4ae] [--cluster-other:#8a8985] dark:[--cluster-1:#3987e5] dark:[--cluster-2:#d95926] dark:[--cluster-3:#199e70] dark:[--cluster-4:#c98500] dark:[--cluster-5:#d55181] dark:[--cluster-6:#008300] dark:[--cluster-7:#9085e9] dark:[--cluster-8:#e66767] dark:[--cluster-none:#55544f] dark:[--cluster-other:#6f6e69]"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <ul data-testid="telemetry-legend" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {timeline.legend.map(({ slot, label }) => (
            <li key={String(slot)} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: readSlotFill(slot) }}
              />
              {label}
            </li>
          ))}
          <li className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
            <span aria-hidden="true">●</span> copy
          </li>
          <li className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
            <span aria-hidden="true">■</span> paste
          </li>
        </ul>
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Zoom">
          <button
            type="button"
            data-testid="telemetry-zoom-out"
            disabled={zoomIndex === 0}
            onClick={() => {
              setZoomIndex((index) => Math.max(0, index - 1));
            }}
            className="rounded border border-neutral-300 px-2 py-0.5 disabled:opacity-40 dark:border-neutral-700"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            data-testid="telemetry-zoom-in"
            disabled={zoomIndex === ZOOMS.length - 1}
            onClick={() => {
              setZoomIndex((index) => Math.min(ZOOMS.length - 1, index + 1));
            }}
            className="rounded border border-neutral-300 px-2 py-0.5 disabled:opacity-40 dark:border-neutral-700"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            data-testid="telemetry-zoom-fit"
            disabled={zoomIndex === 0}
            onClick={() => {
              setZoomIndex(0);
            }}
            className="rounded border border-neutral-300 px-2 py-0.5 disabled:opacity-40 dark:border-neutral-700"
          >
            Fit
          </button>
        </div>
      </div>
      <div ref={container} className="relative min-h-0 overflow-x-auto overflow-y-hidden">
        <svg
          role="img"
          aria-label={`Reading timeline: ${timeline.blocks.length} intervals`}
          width={scale.width + 2 * PADDING_X}
          height={HEIGHT}
          className="block text-neutral-700 dark:text-neutral-300"
        >
          <g transform={`translate(${PADDING_X} 0)`}>
            {timeline.runs.map((run) => {
              const x = scale.toX(run.start);
              const width = scale.toX(run.end) - x;

              if (width < LABEL_MINIMUM_WIDTH) {
                return null;
              }

              const centre = x + width / 2;

              return (
                <g key={`${run.start}-${String(run.slot)}`} data-testid="telemetry-run-label">
                  <text
                    transform={`translate(${centre + 4} ${LABEL_BAND - 6}) rotate(-90)`}
                    className="fill-current text-[11px]"
                  >
                    {run.label.length > 18 ? `${run.label.slice(0, 17)}…` : run.label}
                  </text>
                  <rect
                    x={centre - 1}
                    y={LABEL_BAND}
                    width={2}
                    height={6}
                    style={{ fill: readSlotFill(run.slot) }}
                  />
                </g>
              );
            })}
            {timeline.blocks.map((block, index) => {
              const x = scale.toX(block.start);
              const width = Math.max(1, scale.toX(block.end) - x - 1);
              const height = readBlockHeight(block.start, block.end);
              const node = nodes.get(block.nodeId);
              const title = node?.title.trim() === "" ? (node?.url ?? "") : (node?.title ?? "");

              return (
                <rect
                  key={`${block.nodeId}-${block.start}`}
                  data-testid="telemetry-block"
                  data-node-id={block.nodeId}
                  x={x}
                  y={BASELINE - height}
                  width={width}
                  height={height}
                  rx={Math.min(2, width / 2)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${title}, ${formatClock(block.start)}, ${formatDuration(block.end - block.start)}`}
                  style={{ fill: readSlotFill(block.slot) }}
                  className="cursor-pointer outline-none hover:opacity-80 focus-visible:stroke-blue-600 focus-visible:stroke-2"
                  onMouseEnter={(event) => {
                    const bounds = container.current?.getBoundingClientRect();

                    show(
                      index,
                      event.clientX - (bounds?.left ?? 0) + (container.current?.scrollLeft ?? 0),
                      BASELINE + 8,
                    );
                  }}
                  onMouseLeave={() => {
                    setHovered(undefined);
                  }}
                  onFocus={() => {
                    show(index, x + PADDING_X, BASELINE + 8);
                  }}
                  onBlur={() => {
                    setHovered(undefined);
                  }}
                  onClick={() => {
                    activate(block.nodeId);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      activate(block.nodeId);
                    }
                  }}
                />
              );
            })}
            {timeline.marks.map((mark, index) => {
              const x = scale.toX(mark.at);

              return mark.kind === "copy" ? (
                <circle
                  key={`copy-${mark.at}-${index}`}
                  data-testid="telemetry-mark"
                  data-kind="copy"
                  cx={x}
                  cy={BASELINE + 14}
                  r={4}
                  className="fill-current"
                />
              ) : (
                <rect
                  key={`paste-${mark.at}-${index}`}
                  data-testid="telemetry-mark"
                  data-kind="paste"
                  x={x - 4}
                  y={BASELINE + 10}
                  width={8}
                  height={8}
                  className="fill-current"
                />
              );
            })}
            <line
              x1={0}
              x2={scale.width}
              y1={BASELINE + 26}
              y2={BASELINE + 26}
              className="stroke-neutral-300 dark:stroke-neutral-700"
            />
            {scale.ticks.map((tick) => (
              <g key={tick.at}>
                <line
                  x1={tick.x}
                  x2={tick.x}
                  y1={BASELINE + 26}
                  y2={BASELINE + 32}
                  className="stroke-current"
                />
                <text x={tick.x + 3} y={BASELINE + 46} className="fill-current text-[11px]">
                  {formatClock(tick.at)}
                </text>
              </g>
            ))}
            {scale.breaks.map((pause) => (
              <text
                key={pause.x}
                x={pause.x}
                y={BASELINE - 8}
                textAnchor="middle"
                className="fill-current text-xs"
              >
                ⋯
              </text>
            ))}
          </g>
        </svg>
        {hovered !== undefined && hoveredBlock !== undefined && hoveredNode !== undefined && (
          <div
            data-testid="telemetry-tooltip"
            role="tooltip"
            className="pointer-events-none absolute z-10 w-80 rounded-lg border border-neutral-200 bg-white p-3 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
            style={{ left: Math.max(0, hovered.x - 24), top: hovered.y }}
          >
            <p className="flex items-center gap-1.5 font-medium">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: readSlotFill(hoveredBlock.slot) }}
              />
              {hoveredRun?.label ?? "Unclustered"}
              <span className="font-normal text-neutral-500">
                {` ${formatClock(hoveredBlock.start)} · ${formatDuration(hoveredBlock.end - hoveredBlock.start)}`}
              </span>
            </p>
            <p className="mt-1 truncate font-medium">
              {hoveredNode.title.trim() === "" ? hoveredNode.url : hoveredNode.title}
            </p>
            <p className="truncate text-neutral-500">{hoveredNode.domain}</p>
            <p
              data-testid="telemetry-excerpt"
              className="mt-2 line-clamp-6 whitespace-pre-line text-neutral-700 dark:text-neutral-300"
            >
              {excerpt === undefined
                ? "Loading…"
                : excerpt === null
                  ? "No text was captured from this page."
                  : excerpt}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
