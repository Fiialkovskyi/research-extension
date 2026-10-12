import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { GraphSnapshot, MapNode } from "../../types";
import { ResearchMap } from ".";

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

const buildNode = (id: string, overrides: Partial<MapNode> = {}): MapNode => ({
  id,
  title: id.toUpperCase(),
  url: `https://example.com/${id}`,
  domain: "example.com",
  tabId: 1,
  tabState: "open",
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  createdAt: 0,
  ...overrides,
});

const snapshot: GraphSnapshot = {
  session: { id: "session-1", title: "E-bike motors" },
  nodes: [buildNode("a", { tabState: "closed" }), buildNode("b", { tabId: 7, parentNodeId: "a" })],
  edges: [{ id: "a|b|sameTab", from: "a", to: "b", kind: "sameTab" }],
};

const findNode = (id: string) => {
  const node = screen
    .getAllByTestId("map-node")
    .find((candidate) => candidate.dataset["nodeId"] === id);

  if (node === undefined) {
    throw new Error(`No map node "${id}".`);
  }

  return node;
};

describe("ResearchMap", () => {
  it("draws every page with its title, domain and state", () => {
    render(<ResearchMap snapshot={snapshot} onFocusTab={() => {}} />);

    expect(screen.getAllByTestId("map-node")).toHaveLength(2);
    expect(findNode("a")).toHaveTextContent("A");
    expect(findNode("a")).toHaveTextContent("example.com · closed");
    expect(findNode("a")).toHaveAttribute("data-tab-state", "closed");
    expect(findNode("b")).toHaveAttribute("data-tab-state", "open");
  });

  it("makes an open page a button and a closed one not", () => {
    render(<ResearchMap snapshot={snapshot} onFocusTab={() => {}} />);

    expect(findNode("b").tagName).toBe("BUTTON");
    expect(findNode("a").tagName).not.toBe("BUTTON");
  });

  it("asks to focus an open page's tab when it is clicked", () => {
    const onFocusTab = vi.fn();
    render(<ResearchMap snapshot={snapshot} onFocusTab={onFocusTab} />);

    fireEvent.click(findNode("b"));

    expect(onFocusTab).toHaveBeenCalledWith(7);
  });

  it("does nothing when a closed page is clicked", () => {
    const onFocusTab = vi.fn();
    render(<ResearchMap snapshot={snapshot} onFocusTab={onFocusTab} />);

    fireEvent.click(findNode("a"));

    expect(onFocusTab).not.toHaveBeenCalled();
  });

  it("draws the pages a later snapshot adds", () => {
    const { rerender } = render(<ResearchMap snapshot={snapshot} onFocusTab={() => {}} />);

    rerender(
      <ResearchMap
        snapshot={{
          ...snapshot,
          nodes: [...snapshot.nodes, buildNode("c", { tabId: 8, openerNodeId: "b" })],
          edges: [...snapshot.edges, { id: "b|c|opener", from: "b", to: "c", kind: "opener" }],
        }}
        onFocusTab={() => {}}
      />,
    );

    expect(screen.getAllByTestId("map-node")).toHaveLength(3);
  });
});
