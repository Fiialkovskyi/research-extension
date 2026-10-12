import type { MapNode } from "@/features/researchMap";

/** A page in the research tree, with the pages reached from it. */
export interface TreeRow {
  node: MapNode;
  children: TreeRow[];
}

const compareRecorded = (first: MapNode, second: MapNode): number =>
  first.createdAt - second.createdAt || first.id.localeCompare(second.id);

/**
 * Arranges a session's pages as a tree: each under the page it was reached
 * from — the previous page in its tab, or, for a tab's first page, the page
 * that opened its tab. A page reached from neither, such as a search typed
 * into a fresh tab, is a root. Siblings are in the order they were recorded.
 *
 * Both links point to an earlier page, so the tree has no cycles; a page met a
 * second time is nonetheless made a root rather than followed again.
 */
export const buildResearchTree = (nodes: readonly MapNode[]): TreeRow[] => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childrenOf = new Map<string | null, MapNode[]>();

  for (const node of nodes) {
    const parentId = node.parentNodeId ?? node.openerNodeId;
    const key = parentId !== null && parentId !== node.id && byId.has(parentId) ? parentId : null;

    childrenOf.set(key, [...(childrenOf.get(key) ?? []), node]);
  }

  const placed = new Set<string>();
  const build = (parentId: string | null): TreeRow[] =>
    (childrenOf.get(parentId) ?? [])
      .toSorted(compareRecorded)
      .filter((node) => !placed.has(node.id))
      .map((node) => {
        placed.add(node.id);

        return { node, children: build(node.id) };
      });

  const roots = build(null);
  // Pages only reachable through a cycle were never placed: each becomes a
  // root, taking along whatever hangs from it that is not placed yet.
  const stranded: TreeRow[] = [];

  for (const node of nodes.toSorted(compareRecorded)) {
    if (!placed.has(node.id)) {
      placed.add(node.id);
      stranded.push({ node, children: build(node.id) });
    }
  }

  return [...roots, ...stranded];
};
