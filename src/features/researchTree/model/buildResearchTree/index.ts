import type { MapCluster, MapNode } from "@/features/researchMap";

/** A row of the research tree: a page, or a cluster grouping pages. */
export type TreeRow = {
  /** The page's id, or `cluster:<id>` for a cluster. */
  id: string;
  children: TreeRow[];
} & (
  | { kind: "page"; node: MapNode }
  | {
      kind: "cluster";
      /** The cluster's label, or `Unclustered` for the pages that formed none. */
      label: string;
      /** How many pages it holds. */
      size: number;
    }
);

/** The row id of the pool of pages that formed no cluster of their own. */
export const UNCLUSTERED_ROW_ID = "cluster:unclustered";

const compareRecorded = (first: MapNode, second: MapNode): number =>
  first.createdAt - second.createdAt || first.id.localeCompare(second.id);

/**
 * Arranges pages by how they were reached: each under the previous page in
 * its tab, or, for a tab's first page, the page that opened its tab — when
 * that page is among them. The others are roots. Siblings are in the order
 * they were recorded. A page met a second time is made a root rather than
 * followed again.
 */
const buildPageForest = (nodes: readonly MapNode[]): TreeRow[] => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childrenOf = new Map<string | null, MapNode[]>();

  for (const node of nodes) {
    const parentId = node.parentNodeId ?? node.openerNodeId;
    const key = parentId !== null && parentId !== node.id && byId.has(parentId) ? parentId : null;

    childrenOf.set(key, [...(childrenOf.get(key) ?? []), node]);
  }

  const placed = new Set<string>();
  const place = (node: MapNode): TreeRow => {
    placed.add(node.id);

    return { kind: "page", id: node.id, node, children: build(node.id) };
  };
  const build = (parentId: string | null): TreeRow[] =>
    (childrenOf.get(parentId) ?? [])
      .toSorted(compareRecorded)
      .filter((node) => !placed.has(node.id))
      .map(place);
  const roots = build(null);

  // Pages only reachable through a cycle were never placed: each becomes a
  // root, taking along whatever hangs from it that is not placed yet.
  for (const node of nodes.toSorted(compareRecorded)) {
    if (!placed.has(node.id)) {
      roots.push(place(node));
    }
  }

  return roots;
};

/**
 * Arranges a session's pages as the research tree.
 *
 * Once the session has more than one cluster, each cluster of two or more pages
 * becomes a top-level row holding its own pages, arranged as above with links
 * to pages outside it ignored; clusters of one are pooled under a last
 * `Unclustered` row. Cluster rows are in the order their first pages were
 * recorded. With one cluster or none, the pages are arranged ungrouped.
 */
export const buildResearchTree = (
  nodes: readonly MapNode[],
  clusters: readonly MapCluster[] = [],
): TreeRow[] => {
  if (clusters.length < 2) {
    return buildPageForest(nodes);
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const grouped = new Set<string>();
  const rows: { first: MapNode; row: TreeRow }[] = [];

  for (const cluster of clusters) {
    const members = cluster.memberIds
      .map((id) => byId.get(id))
      .filter((node): node is MapNode => node !== undefined)
      .toSorted(compareRecorded);
    const [first] = members;

    if (first !== undefined && members.length > 1) {
      members.forEach(({ id }) => grouped.add(id));
      rows.push({
        first,
        row: {
          kind: "cluster",
          id: `cluster:${cluster.id}`,
          label: cluster.label,
          size: members.length,
          children: buildPageForest(members),
        },
      });
    }
  }

  const loose = nodes.filter(({ id }) => !grouped.has(id));
  const ordered = rows
    .toSorted((first, second) => compareRecorded(first.first, second.first))
    .map(({ row }) => row);

  return loose.length === 0
    ? ordered
    : [
        ...ordered,
        {
          kind: "cluster",
          id: UNCLUSTERED_ROW_ID,
          label: "Unclustered",
          size: loose.length,
          children: buildPageForest(loose),
        },
      ];
};
