import { MAP_DOCUMENT_KEY, MAP_NODES_CHANGED_KEY } from "../../constants";

/**
 * Builds the script, evaluated in the map page, that reports what it shows: the
 * empty state, the session title, every node with its label, kind, text, state, engagement and place,
 * and every edge with its kind.
 *
 * A node's place is the top-left corner of the box React Flow positions, so a
 * node drawn below another has a larger `top`.
 *
 * The first read in a document tags it, so a later read can tell whether the
 * page was reloaded, and starts watching the number of nodes: each change is
 * stamped with the time it happened in the page, so a spec can measure how
 * long an update took without depending on how often it polls.
 */
export const buildMapReaderScript = (): string => {
  const key = JSON.stringify(MAP_DOCUMENT_KEY);
  const changedKey = JSON.stringify(MAP_NODES_CHANGED_KEY);

  return `
    const countNodes = () => document.querySelectorAll('[data-testid="map-node"]').length;
    if (window[${key}] === undefined) {
      window[${key}] = String(Math.random());
      window[${changedKey}] = null;
      let count = countNodes();
      new MutationObserver(() => {
        if (countNodes() !== count) {
          count = countNodes();
          window[${changedKey}] = Date.now();
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
    const readKind = (edge) =>
      edge.classList.contains("edge-opener") ? "opener"
        : edge.classList.contains("edge-sameTab") ? "sameTab"
        : edge.classList.contains("edge-refinement") ? "refinement" : "other";
    return JSON.stringify({
      documentId: window[${key}],
      nodesChangedAt: window[${changedKey}],
      empty: !!document.querySelector('[data-testid="map-empty"]'),
      sessionTitle: document.querySelector('[data-testid="map-session-title"]')?.textContent ?? null,
      nodes: Array.from(document.querySelectorAll('[data-testid="map-node"]'), (node) => {
        const box = (node.closest(".react-flow__node") ?? node).getBoundingClientRect();
        return {
          id: node.dataset.nodeId,
          label: node.title,
          kind: node.dataset.nodeKind,
          text: node.textContent,
          tabState: node.dataset.tabState,
          engagement: node.dataset.engagement,
          isButton: node.tagName === "BUTTON",
          top: box.top,
          left: box.left,
        };
      }),
      edges: Array.from(document.querySelectorAll(".react-flow__edge"), (edge) => ({
        id: edge.dataset.id,
        kind: readKind(edge),
      })),
    });
  `;
};
