import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GraphSnapshot, MapNode } from "../../types";
import { TelemetryView } from ".";

const MINUTE = 60_000;

const buildNode = (id: string, tabId: number, overrides: Partial<MapNode> = {}): MapNode => ({
  id,
  title: `Page ${id}`,
  url: `https://example.com/${id}`,
  domain: "example.com",
  kind: "page",
  tabId,
  tabState: "open",
  engagement: "skimmed",
  copyEvents: 0,
  pasteEvents: 0,
  activeDwellMs: 0,
  focusCount: 0,
  revisitCount: 0,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  createdAt: 0,
  ...overrides,
});

const snapshot: GraphSnapshot = {
  session: { id: "session-1", title: "E-bike motors" },
  nodes: [buildNode("a", 1), buildNode("b", 2), buildNode("c", 3, { tabState: "closed" })],
  edges: [],
  clusters: [{ id: "k", label: "Motors", memberIds: ["a", "b"] }],
  activity: [
    { nodeId: "a", kind: "focus", at: 0, endAt: 20 * MINUTE },
    { nodeId: "b", kind: "focus", at: 20 * MINUTE, endAt: 40 * MINUTE },
    { nodeId: "c", kind: "focus", at: 40 * MINUTE, endAt: 60 * MINUTE },
    { nodeId: "a", kind: "copy", at: 5 * MINUTE, endAt: 5 * MINUTE },
    { nodeId: "c", kind: "paste", at: 50 * MINUTE, endAt: 50 * MINUTE },
  ],
};

const findBlock = (nodeId: string) => {
  const block = screen
    .getAllByTestId("telemetry-block")
    .find((candidate) => candidate.dataset["nodeId"] === nodeId);

  if (block === undefined) {
    throw new Error(`No block for "${nodeId}".`);
  }

  return block;
};

const renderView = (
  overrides: Partial<Pick<Parameters<typeof TelemetryView>[0], "snapshot" | "excerpts">> = {},
) => {
  const onReadExcerpt = vi.fn();
  const onFocusTab = vi.fn();

  render(
    <TelemetryView
      snapshot={overrides.snapshot ?? snapshot}
      excerpts={overrides.excerpts ?? {}}
      onReadExcerpt={onReadExcerpt}
      onFocusTab={onFocusTab}
    />,
  );

  return { onReadExcerpt, onFocusTab };
};

describe("TelemetryView", () => {
  it("draws a block per interval, a label per run of one cluster, and the marks", () => {
    renderView();

    expect(screen.getAllByTestId("telemetry-block")).toHaveLength(3);
    expect(screen.getAllByTestId("telemetry-run-label").map((label) => label.textContent)).toEqual([
      "Motors",
      "Unclustered",
    ]);
    expect(screen.getAllByTestId("telemetry-mark").map((mark) => mark.dataset["kind"])).toEqual([
      "copy",
      "paste",
    ]);
  });

  it("names each colour in the legend", () => {
    renderView();

    expect(screen.getByTestId("telemetry-legend")).toHaveTextContent("MotorsUnclustered");
  });

  it("shows the hovered page and asks for its text once", () => {
    const { onReadExcerpt } = renderView();

    fireEvent.mouseEnter(findBlock("b"));

    expect(screen.getByTestId("telemetry-tooltip")).toHaveTextContent("Motors");
    expect(screen.getByTestId("telemetry-tooltip")).toHaveTextContent("Page b");
    expect(screen.getByTestId("telemetry-tooltip")).toHaveTextContent("20m");
    expect(screen.getByTestId("telemetry-excerpt")).toHaveTextContent("Loading…");
    expect(onReadExcerpt).toHaveBeenCalledWith("b");
  });

  it("shows a page's captured text once it is known", () => {
    const { onReadExcerpt } = renderView({ excerpts: { a: "Mid-drive motors compared." } });

    fireEvent.focus(findBlock("a"));

    expect(screen.getByTestId("telemetry-excerpt")).toHaveTextContent("Mid-drive motors compared.");
    expect(onReadExcerpt).not.toHaveBeenCalled();
  });

  it("selects an open page's tab on click or Enter, and not a closed one's", () => {
    const { onFocusTab } = renderView();

    fireEvent.click(findBlock("a"));
    fireEvent.keyDown(findBlock("b"), { key: "Enter" });
    fireEvent.click(findBlock("c"));

    expect(onFocusTab.mock.calls).toEqual([[1], [2]]);
  });

  it("says when no reading time was logged", () => {
    renderView({ snapshot: { ...snapshot, activity: [] } });

    expect(screen.getByTestId("map-telemetry-empty")).toBeInTheDocument();
  });

  it("zooms in and back to fit", () => {
    renderView();

    const svg = screen.getByRole("img");
    const fitted = Number(svg.getAttribute("width"));

    fireEvent.click(screen.getByTestId("telemetry-zoom-in"));

    expect(Number(svg.getAttribute("width"))).toBeGreaterThan(fitted);

    fireEvent.click(screen.getByTestId("telemetry-zoom-fit"));

    expect(Number(svg.getAttribute("width"))).toBe(fitted);
  });
});
