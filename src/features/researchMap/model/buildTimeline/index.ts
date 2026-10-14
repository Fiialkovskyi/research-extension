import { TIMELINE_CLUSTER_SLOTS } from "../../constants";
import type { GraphSnapshot } from "../../types";

/**
 * A pause longer than this splits the timeline: the stretch on either side is
 * drawn to scale, the pause itself as a short break, so a session resumed the
 * next morning does not spend the width on the night.
 */
const BREAK_AFTER_MS = 15 * 60_000;

/**
 * Which colour a page's cluster takes: its place in the session's clusters, up
 * to the palette's size. `"other"` for a cluster past it, `null` for a page
 * clustering has not placed.
 */
export type ClusterSlot = number | "other" | null;

/** One stretch of reading one page. */
export interface TimelineBlock {
  nodeId: string;
  start: number;
  end: number;
  slot: ClusterSlot;
}

/** Back-to-back blocks of one cluster, labelled once above them. */
export interface TimelineRun {
  slot: ClusterSlot;
  label: string;
  start: number;
  end: number;
}

/** A copy or a paste, marked under the block it happened in. */
export interface TimelineMark {
  nodeId: string;
  kind: "copy" | "paste";
  at: number;
}

/** A stretch of activity drawn to scale; the pauses between them are breaks. */
export interface TimelineSegment {
  start: number;
  end: number;
}

/** A cluster the legend names. */
export interface TimelineLegendEntry {
  slot: ClusterSlot;
  label: string;
}

/** The session as the telemetry view draws it. */
export interface Timeline {
  blocks: TimelineBlock[];
  runs: TimelineRun[];
  marks: TimelineMark[];
  segments: TimelineSegment[];
  legend: TimelineLegendEntry[];
}

/** What a run is called: its cluster's label, or what stands in for one. */
const readRunLabel = (slot: ClusterSlot, labels: readonly string[]): string => {
  if (slot === null) {
    return "Unclustered";
  }

  return slot === "other" ? "Other" : (labels[slot] ?? "Unclustered");
};

/**
 * Builds the telemetry view's timeline: every interval of reading as a block
 * coloured by its page's cluster, runs of one cluster labelled once, copies
 * and pastes as marks, and long pauses as breaks between segments.
 *
 * A cluster's colour follows the cluster, not its rank on screen: it is the
 * cluster's place in the session's clustering, which a new interval does not
 * change.
 */
export const buildTimeline = (snapshot: GraphSnapshot): Timeline => {
  const labels = snapshot.clusters.map(({ label }) => label);
  const slotByNode = new Map<string, ClusterSlot>();

  snapshot.clusters.forEach(({ memberIds }, index) => {
    for (const id of memberIds) {
      slotByNode.set(id, index < TIMELINE_CLUSTER_SLOTS ? index : "other");
    }
  });

  const known = new Set(snapshot.nodes.map(({ id }) => id));
  const blocks: TimelineBlock[] = snapshot.activity
    .filter(({ kind, nodeId, at, endAt }) => kind === "focus" && known.has(nodeId) && endAt > at)
    .toSorted((first, second) => first.at - second.at)
    .map(({ nodeId, at, endAt }) => ({
      nodeId,
      start: at,
      end: endAt,
      slot: slotByNode.get(nodeId) ?? null,
    }));
  const runs: TimelineRun[] = [];
  const segments: TimelineSegment[] = [];

  for (const block of blocks) {
    const run = runs.at(-1);
    const segment = segments.at(-1);

    if (segment === undefined || block.start - segment.end > BREAK_AFTER_MS) {
      segments.push({ start: block.start, end: block.end });
    } else {
      segment.end = Math.max(segment.end, block.end);
    }

    if (run !== undefined && run.slot === block.slot && block.start - run.end <= BREAK_AFTER_MS) {
      run.end = Math.max(run.end, block.end);
    } else {
      runs.push({
        slot: block.slot,
        label: readRunLabel(block.slot, labels),
        start: block.start,
        end: block.end,
      });
    }
  }

  const marks: TimelineMark[] = snapshot.activity
    .filter(
      (record): record is typeof record & { kind: "copy" | "paste" } =>
        record.kind !== "focus" && known.has(record.nodeId),
    )
    .map(({ nodeId, kind, at }) => ({ nodeId, kind, at }))
    .toSorted((first, second) => first.at - second.at);
  const shownSlots = new Set(blocks.map(({ slot }) => slot));
  const legend: TimelineLegendEntry[] = [
    ...labels
      .slice(0, TIMELINE_CLUSTER_SLOTS)
      .flatMap((label, index) => (shownSlots.has(index) ? [{ slot: index, label }] : [])),
    ...(shownSlots.has("other") ? [{ slot: "other" as const, label: "Other" }] : []),
    ...(shownSlots.has(null) ? [{ slot: null, label: "Unclustered" }] : []),
  ];

  return { blocks, runs, marks, segments, legend };
};
