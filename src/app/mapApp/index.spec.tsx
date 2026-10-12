import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GraphSnapshot } from "@/features/researchMap";
import { buildRpcMessage } from "@/shared/rpc";
import { MapApp, type MapClient } from ".";

// The map itself is React Flow, which jsdom cannot lay out; its own spec covers
// it. Here it is a list of buttons, so the page's state handling is what is tested.
vi.mock("@/features/researchMap/ui/researchMap", () => ({
  ResearchMap: ({
    snapshot,
    onFocusTab,
  }: {
    snapshot: GraphSnapshot;
    onFocusTab: (tabId: number) => void;
  }) => (
    <ul data-testid="research-map">
      {snapshot.nodes.map((node) => (
        <li key={node.id}>
          <button type="button" onClick={() => onFocusTab(node.tabId)}>
            {node.title}
          </button>
        </li>
      ))}
    </ul>
  ),
}));

/** A client that records what was sent and can push messages back. */
const createStubClient = () => {
  const sent: { type: string; payload: unknown }[] = [];
  const listeners: ((message: unknown) => void)[] = [];

  const client: MapClient = {
    send: (message) => sent.push({ type: message.type, payload: message.payload }),
    subscribe: (listener) => {
      listeners.push(listener);

      return () => {
        listeners.splice(listeners.indexOf(listener), 1);
      };
    },
  };

  return {
    client,
    sent,
    push: (type: string, payload: unknown) => {
      act(() => {
        for (const listener of Array.from(listeners)) {
          listener(buildRpcMessage(type, payload));
        }
      });
    },
  };
};

const buildSnapshot = (...titles: string[]): GraphSnapshot => ({
  session: { id: "session-1", title: "E-bike motors" },
  nodes: titles.map((title, index) => ({
    id: `node-${index}`,
    title,
    url: `https://example.org/${index}`,
    domain: "example.org",
    kind: "page" as const,
    tabId: 7 + index,
    tabState: "open",
    engagement: "skimmed" as const,
    copyEvents: 0,
    parentNodeId: null,
    openerNodeId: null,
    transitionType: "link",
    createdAt: index,
  })),
  edges: [],
});

describe("MapApp", () => {
  it("subscribes to the graph and waits for it", () => {
    const { client, sent } = createStubClient();

    render(<MapApp client={client} />);

    expect(sent.map((message) => message.type)).toContain("graph.subscribe");
    expect(screen.getByTestId("map-loading")).toBeInTheDocument();
  });

  it("says when no session is active", () => {
    const { client, push } = createStubClient();
    render(<MapApp client={client} />);

    push("graph.snapshot", { session: null, nodes: [], edges: [] });

    expect(screen.getByTestId("map-empty")).toHaveTextContent("No active research session.");
    expect(screen.queryByTestId("research-map")).not.toBeInTheDocument();
  });

  it("draws the session's graph, replaced by each new snapshot", () => {
    const { client, push } = createStubClient();
    render(<MapApp client={client} />);

    push("graph.snapshot", buildSnapshot("A"));
    push("graph.snapshot", buildSnapshot("A", "B"));

    expect(screen.getByTestId("map-session-title")).toHaveTextContent("E-bike motors");
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["A", "B"]);
  });

  it("asks to focus the tab of an activated page", () => {
    const { client, push, sent } = createStubClient();
    render(<MapApp client={client} />);
    push("graph.snapshot", buildSnapshot("A", "B"));

    fireEvent.click(screen.getByRole("button", { name: "B" }));

    expect(sent.at(-1)).toEqual({ type: "tab.focus", payload: { tabId: 8 } });
  });

  it("says why a page could not be shown, until one can", () => {
    const { client, push } = createStubClient();
    render(<MapApp client={client} />);
    push("graph.snapshot", buildSnapshot("A"));

    push("tab.focusRefused", { tabId: 7, reason: "This page's tab is not open." });

    expect(screen.getByTestId("map-error")).toHaveTextContent("This page's tab is not open.");

    push("tab.focused", { tabId: 7 });

    expect(screen.queryByTestId("map-error")).not.toBeInTheDocument();
  });

  it("ignores a message it cannot validate", () => {
    const { client, push } = createStubClient();
    render(<MapApp client={client} />);

    push("graph.snapshot", { nodes: "not a graph" });

    expect(screen.getByTestId("map-loading")).toBeInTheDocument();
  });
});
