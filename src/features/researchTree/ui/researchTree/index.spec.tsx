import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ResearchTree } from ".";
import type { MapNode } from "@/features/researchMap";
import { buildResearchTree } from "../../model/buildResearchTree";
import type { TreeFocus } from "../../model/moveTreeFocus";

const buildNode = (id: string, overrides: Partial<MapNode> = {}): MapNode => ({
  id,
  title: `Page ${id.toUpperCase()}`,
  url: `https://example.org/${id}`,
  domain: "example.org",
  kind: "page",
  tabId: 1,
  tabState: "open",
  engagement: "skimmed",
  copyEvents: 0,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  createdAt: 0,
  ...overrides,
});

/** A search, result A opened from it, B reached from A, and closed C. */
const NODES = [
  buildNode("s", { kind: "serp", query: "e-bike motors", createdAt: 1, tabId: 1 }),
  buildNode("a", {
    openerNodeId: "s",
    createdAt: 2,
    tabId: 2,
    engagement: "deep_read",
    copyEvents: 1,
  }),
  buildNode("b", { parentNodeId: "a", createdAt: 3, tabId: 2 }),
  buildNode("c", {
    openerNodeId: "s",
    createdAt: 4,
    tabId: 3,
    tabState: "closed",
    engagement: "dead_end",
  }),
];

/** The tree with its focus held as the popup holds it. */
function Harness({ onFocusTab }: { onFocusTab: (tabId: number) => void }) {
  const [focus, setFocus] = useState<TreeFocus>({ focusedId: undefined, collapsed: new Set() });

  return (
    <ResearchTree
      forest={buildResearchTree(NODES)}
      focus={focus}
      onFocusChange={setFocus}
      onFocusTab={onFocusTab}
    />
  );
}

const readRow = (name: RegExp) => screen.getByRole("treeitem", { name });

describe("ResearchTree", () => {
  it("is a tree whose rows say their level, place and whether they are expanded", () => {
    render(<Harness onFocusTab={() => {}} />);

    expect(screen.getByRole("tree", { name: "Research tree" })).toBeInTheDocument();
    expect(readRow(/e-bike motors/)).toHaveAttribute("aria-level", "1");
    expect(readRow(/e-bike motors/)).toHaveAttribute("aria-expanded", "true");
    expect(readRow(/Page A/)).toHaveAttribute("aria-level", "2");
    expect(readRow(/Page A/)).toHaveAttribute("aria-posinset", "1");
    expect(readRow(/Page A/)).toHaveAttribute("aria-setsize", "2");
    expect(readRow(/Page B/)).toHaveAttribute("aria-level", "3");
    expect(readRow(/Page B/)).not.toHaveAttribute("aria-expanded");
  });

  it("is one tab stop, on the first row until focus moves", () => {
    render(<Harness onFocusTab={() => {}} />);

    expect(screen.getAllByRole("treeitem").filter((row) => row.tabIndex === 0)).toEqual([
      readRow(/e-bike motors/),
    ]);
  });

  it("says what was done with each page, not by colour alone", () => {
    render(<Harness onFocusTab={() => {}} />);

    expect(readRow(/e-bike motors/)).toHaveTextContent("search · e-bike motors");
    expect(readRow(/Page A/)).toHaveTextContent("deep read");
    expect(within(readRow(/Page A/)).getByRole("img", { name: "copied from" })).toBeInTheDocument();
    expect(within(readRow(/Page B/)).queryByRole("img", { name: "copied from" })).toBeNull();
    expect(readRow(/Page C/)).toHaveTextContent("dead end · closed");
  });

  it("walks the tree with the arrow keys, collapsing with Left", () => {
    render(<Harness onFocusTab={() => {}} />);

    const tree = screen.getByRole("tree");

    readRow(/e-bike motors/).focus();
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    fireEvent.keyDown(tree, { key: "ArrowDown" });

    expect(readRow(/Page B/)).toHaveFocus();
    expect(readRow(/Page B/)).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tree, { key: "ArrowLeft" });
    expect(readRow(/Page A/)).toHaveFocus();

    fireEvent.keyDown(tree, { key: "ArrowLeft" });
    expect(readRow(/Page A/)).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: /Page B/ })).toBeNull();

    fireEvent.keyDown(tree, { key: "End" });
    expect(readRow(/Page C/)).toHaveFocus();
  });

  it("returns to an open page's tab on Enter or a click, and not to a closed one's", () => {
    const onFocusTab = vi.fn();

    render(<Harness onFocusTab={onFocusTab} />);

    const tree = screen.getByRole("tree");

    readRow(/e-bike motors/).focus();
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    fireEvent.keyDown(tree, { key: "Enter" });
    fireEvent.click(readRow(/Page B/));
    fireEvent.click(readRow(/Page C/));
    fireEvent.keyDown(tree, { key: "Enter" });

    expect(onFocusTab.mock.calls).toEqual([[2], [2]]);
  });

  it("draws a cluster as a row named by its label and size, which selects no tab", () => {
    const onFocusTab = vi.fn();
    const clusters = [
      { id: "k1", label: "e-bike motors", memberIds: ["s", "a", "b"] },
      { id: "k2", label: "Page C", memberIds: ["c"] },
    ];

    function Clustered() {
      const [focus, setFocus] = useState<TreeFocus>({ focusedId: undefined, collapsed: new Set() });

      return (
        <ResearchTree
          forest={buildResearchTree(NODES, clusters)}
          focus={focus}
          onFocusChange={setFocus}
          onFocusTab={onFocusTab}
        />
      );
    }

    render(<Clustered />);

    const motors = screen.getByRole("treeitem", { name: "e-bike motors · 3" });

    expect(motors).toHaveAttribute("data-row-kind", "cluster");
    expect(motors).toHaveAttribute("aria-level", "1");
    expect(readRow(/search · e-bike motors/)).toHaveAttribute("aria-level", "2");
    expect(screen.getByRole("treeitem", { name: "Unclustered · 1" })).toBeInTheDocument();

    fireEvent.click(motors);
    fireEvent.keyDown(screen.getByRole("tree"), { key: "Enter" });

    expect(onFocusTab).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole("tree"), { key: "ArrowLeft" });

    expect(motors).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: /Page A/ })).toBeNull();
  });
});
