import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GraphSnapshot, MapNode } from "../../types";
import { HistoryView } from ".";

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
  createdAt: tabId,
  ...overrides,
});

const snapshot: GraphSnapshot = {
  session: { id: "session-1", title: "E-bike motors" },
  nodes: [buildNode("a", 1), buildNode("b", 2, { tabState: "closed" })],
  edges: [],
  clusters: [],
  activity: [
    { nodeId: "a", kind: "focus", at: 0, endAt: 7 * 60_000 },
    { nodeId: "b", kind: "focus", at: 7 * 60_000, endAt: 8 * 60_000 },
    { nodeId: "a", kind: "focus", at: 8 * 60_000, endAt: 8 * 60_000 + 45_000 },
  ],
};

describe("HistoryView", () => {
  it("lists each stretch of reading in order, with its length", () => {
    render(<HistoryView snapshot={snapshot} onFocusTab={() => {}} />);

    const entries = screen.getAllByTestId("map-history-entry");

    expect(entries.map((entry) => entry.dataset["nodeId"])).toEqual(["a", "b", "a"]);
    expect(entries[0]).toHaveTextContent("Page a");
    expect(entries[0]).toHaveTextContent("7m");
    expect(entries[1]).toHaveTextContent("example.com · closed");
    expect(entries[2]).toHaveTextContent("45s");
  });

  it("asks to focus an open page's tab, and offers nothing for a closed one", () => {
    const onFocusTab = vi.fn();

    render(<HistoryView snapshot={snapshot} onFocusTab={onFocusTab} />);
    fireEvent.click(screen.getAllByRole("button")[0] as HTMLElement);

    expect(onFocusTab).toHaveBeenCalledWith(1);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("says when reading time was not logged, and lists pages as opened", () => {
    render(<HistoryView snapshot={{ ...snapshot, activity: [] }} onFocusTab={() => {}} />);

    expect(screen.getByTestId("map-history-untimed")).toBeInTheDocument();
    expect(screen.getAllByTestId("map-history-entry")).toHaveLength(2);
  });
});
