// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { MAP_DOCUMENT_KEY, MAP_NODES_CHANGED_KEY } from "../../constants";
import { buildMapReaderScript } from ".";

const read = (): Record<string, unknown> =>
  JSON.parse((new Function(buildMapReaderScript()) as () => string)());

afterEach(() => {
  document.body.innerHTML = "";
  delete (window as unknown as Record<string, unknown>)[MAP_DOCUMENT_KEY];
  delete (window as unknown as Record<string, unknown>)[MAP_NODES_CHANGED_KEY];
});

describe("buildMapReaderScript", () => {
  it("reports the empty state", () => {
    document.body.innerHTML = '<p data-testid="map-empty">No active research session.</p>';

    expect(read()).toMatchObject({ empty: true, sessionTitle: null, nodes: [], edges: [] });
  });

  it("reports each node and edge the map draws", () => {
    document.body.innerHTML = `
      <span data-testid="map-session-title">Motors</span>
      <div class="react-flow__node">
        <div data-testid="map-node" data-node-id="a" data-tab-state="closed" data-engagement="dead_end" title="Page A"></div>
      </div>
      <div class="react-flow__node">
        <button data-testid="map-node" data-node-id="b" data-tab-state="open" data-engagement="deep_read" title="Page B"></button>
      </div>
      <svg><g class="react-flow__edge edge-sameTab" data-id="a|b|sameTab"></g>
        <g class="react-flow__edge edge-opener" data-id="a|c|opener"></g></svg>`;

    expect(read()).toMatchObject({
      empty: false,
      sessionTitle: "Motors",
      nodes: [
        { id: "a", label: "Page A", tabState: "closed", engagement: "dead_end", isButton: false },
        { id: "b", label: "Page B", tabState: "open", engagement: "deep_read", isButton: true },
      ],
      edges: [
        { id: "a|b|sameTab", kind: "sameTab" },
        { id: "a|c|opener", kind: "opener" },
      ],
    });
  });

  it("tags the document once, so a reload can be told apart", () => {
    const first = read()["documentId"];

    expect(read()["documentId"]).toBe(first);
    expect(typeof first).toBe("string");
  });

  it("stamps when the number of drawn nodes changes", async () => {
    document.body.innerHTML = '<div id="graph"></div>';

    expect(read()["nodesChangedAt"]).toBeNull();

    const before = Date.now();
    document
      .querySelector("#graph")
      ?.insertAdjacentHTML(
        "beforeend",
        '<div data-testid="map-node" data-node-id="a" data-tab-state="open" title="A"></div>',
      );
    // Mutation observers report after the current task's microtasks.
    await Promise.resolve();

    expect(read()["nodesChangedAt"]).toBeGreaterThanOrEqual(before);
  });
});
