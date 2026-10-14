import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { GraphSnapshot, MapNode } from "../../types";
import { AnchorView } from ".";

/**
 * jsdom measures nothing, and React Flow will not show a node it cannot
 * measure. These are the stand-ins React Flow's own testing guide gives.
 */
class StubResizeObserver {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    const contentRect = { width: 1024, height: 768 } as DOMRectReadOnly;

    this.callback(
      [{ target, contentRect } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  unobserve() {}

  disconnect() {}
}

class StubDOMMatrixReadOnly {
  m22: number;

  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([1-9.])\)/)?.[1];

    this.m22 = scale === undefined ? 1 : Number(scale);
  }
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
  vi.stubGlobal("DOMMatrixReadOnly", StubDOMMatrixReadOnly);
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: {
      get(this: HTMLElement) {
        return Number.parseFloat(this.style.height) || 1;
      },
    },
    offsetWidth: {
      get(this: HTMLElement) {
        return Number.parseFloat(this.style.width) || 1;
      },
    },
  });
  Object.defineProperty(SVGElement.prototype, "getBBox", {
    value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    configurable: true,
  });
});

const buildNode = (id: string, createdAt: number, overrides: Partial<MapNode> = {}): MapNode => ({
  id,
  title: `Page ${id}`,
  url: `https://example.com/${id}`,
  domain: "example.com",
  kind: "page",
  tabId: createdAt,
  tabState: "open",
  engagement: "skimmed",
  copyEvents: 0,
  pasteEvents: 0,
  activeDwellMs: 1_000,
  focusCount: 1,
  revisitCount: 0,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  createdAt,
  ...overrides,
});

const snapshot: GraphSnapshot = {
  session: { id: "session-1", title: "E-bike motors" },
  nodes: [
    buildNode("search", 1, { kind: "serp", query: "best commuter" }),
    buildNode("vado", 2, { revisitCount: 3, focusCount: 4, copyEvents: 2, activeDwellMs: 420_000 }),
    buildNode("notes", 3, { pasteEvents: 8, activeDwellMs: 420_000, tabState: "closed" }),
    buildNode("forum", 4),
  ],
  edges: [{ id: "search|forum|opener", from: "search", to: "forum", kind: "opener" }],
  clusters: [],
  activity: [],
};

const readRoles = () =>
  Object.fromEntries(
    screen
      .getAllByTestId("anchor-node")
      .map((node) => [node.dataset["nodeId"], node.dataset["role"]]),
  );

describe("AnchorView", () => {
  it("draws the anchors and the starting page, with visits, time, copies and pastes", () => {
    render(<AnchorView snapshot={snapshot} onFocusTab={() => {}} />);

    expect(readRoles()).toEqual({ search: "root", vado: "anchor", notes: "collector" });
    expect(screen.getByText("2 anchors")).toBeInTheDocument();

    const vado = screen
      .getAllByTestId("anchor-node")
      .find((node) => node.dataset["nodeId"] === "vado");

    expect(vado).toHaveTextContent("4 visits · 7m");
    expect(vado).toHaveTextContent("2 copies");
  });

  it("adds the other pages when paths are shown", () => {
    render(<AnchorView snapshot={snapshot} onFocusTab={() => {}} />);

    fireEvent.click(screen.getByTestId("anchor-show-paths"));

    expect(readRoles()).toMatchObject({ forum: "page" });
  });

  it("says when there are no anchors yet", () => {
    render(
      <AnchorView
        snapshot={{ ...snapshot, nodes: [buildNode("search", 1), buildNode("forum", 2)] }}
        onFocusTab={() => {}}
      />,
    );

    expect(screen.getByTestId("map-anchors-empty")).toBeInTheDocument();
  });

  it("asks to focus an open page's tab, and not a closed one's", () => {
    const onFocusTab = vi.fn();

    render(<AnchorView snapshot={snapshot} onFocusTab={onFocusTab} />);

    for (const node of screen.getAllByTestId("anchor-node")) {
      fireEvent.click(node);
    }

    expect(onFocusTab.mock.calls).toEqual([[1], [2]]);
  });
});
