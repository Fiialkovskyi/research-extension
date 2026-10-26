import { UndirectedGraph } from "graphology";
import louvain from "graphology-communities-louvain";

import { getNodeEngagement } from "@/features/researchGraph";
import type { StoredCluster, StoredClustering, StoredEdge, StoredNode } from "@/shared/storage";

import { CLUSTER_ALGORITHM_VERSION, CLUSTER_CONFIG_VERSION, CLUSTER_SEED } from "../../constants";
import { buildSeededRandom } from "./utils/buildSeededRandom";
import { buildEntityEdges, type ClusterEntity } from "./utils/buildEntityEdges";
import { buildSemanticEdges, type SemanticInput } from "./utils/buildSemanticEdges";
import { matchClusterIdentity } from "./utils/matchClusterIdentity";
import { readClusterLabel } from "./utils/readClusterLabel";

export interface ClusterSessionOptions {
  sessionId: string;
  nodes: readonly StoredNode[];
  edges: readonly StoredEdge[];
  /** The session's clusters from the last run, whose ids are kept where they fit. */
  previous: readonly StoredCluster[];
  now: number;
  /** Mints an id for a cluster that matches no previous one. */
  createId?: () => string;
  /**
   * Page vectors in the session's embedding space, which add semantic edges
   * between similar pages (REQ-CLU-002). Without them, recorded relations alone.
   */
  semantic?: SemanticInput;
  /**
   * The entities the session resolved: pages that state facts about the same
   * one are linked, and a cluster is named after its main one.
   */
  entities?: readonly ClusterEntity[];
}

const compareRecorded = (first: StoredNode, second: StoredNode): number =>
  first.createdAt - second.createdAt || first.id.localeCompare(second.id);

/** Whether the page was left at a glance; judged as left, since clusters outlive focus. */
const isDeadEnd = (node: StoredNode): boolean =>
  getNodeEngagement(node, { isFocused: false }) === "dead_end";

/**
 * Groups a session's pages into clusters from the relations capture recorded,
 * with no model (REQ-CLU-001).
 *
 * Louvain community detection over the recorded edges, each counting by its
 * stored weight, and, given page vectors, semantic edges between similar pages,
 * and, given entities, edges between pages that state facts about one, seeded so the same graph always gives the same clusters. Dead ends
 * stay out of detection — a page left at once says little about what it
 * belongs to — and join the cluster of the page they were reached from. A page
 * with no relation is a cluster of its own. Each cluster keeps the id of the
 * previous cluster it shares most pages with.
 */
export const clusterSession = ({
  sessionId,
  nodes,
  edges,
  previous,
  now,
  createId,
  semantic,
  entities = [],
}: ClusterSessionOptions): StoredClustering => {
  const ordered = nodes.toSorted(compareRecorded);
  const byId = new Map(ordered.map((node) => [node.id, node]));
  const graph = new UndirectedGraph();

  for (const node of ordered) {
    if (!isDeadEnd(node)) {
      graph.addNode(node.id);
    }
  }

  const memberIds = graph.nodes();
  const semanticPairs = semantic === undefined ? [] : buildSemanticEdges(memberIds, semantic);
  const entityPairs = buildEntityEdges(memberIds, entities);
  const recorded = edges.toSorted((first, second) => first.id.localeCompare(second.id));

  // Recorded, semantic and entity edges alike: a pair joined several ways weighs them all.
  for (const edge of [...recorded, ...semanticPairs, ...entityPairs]) {
    if (edge.from !== edge.to && graph.hasNode(edge.from) && graph.hasNode(edge.to)) {
      if (graph.hasEdge(edge.from, edge.to)) {
        graph.updateEdgeAttribute(
          edge.from,
          edge.to,
          "weight",
          (weight: number | undefined) => (weight ?? 0) + edge.weight,
        );
      } else {
        graph.addEdge(edge.from, edge.to, { weight: edge.weight });
      }
    }
  }

  const usedSpaceId =
    semantic !== undefined && memberIds.some((id) => semantic.vectors.has(id))
      ? semantic.spaceId
      : undefined;

  const communities =
    graph.size === 0
      ? {}
      : louvain(graph, { getEdgeWeight: "weight", rng: buildSeededRandom(CLUSTER_SEED) });
  /** Each placed page's group key: its community, or itself when it has none. */
  const groupOf = new Map<string, string>();

  graph.forEachNode((id) => {
    const community = communities[id];

    groupOf.set(id, community === undefined ? `solo:${id}` : `community:${community}`);
  });

  // Earliest first, so a dead end reached from another dead end finds it placed.
  for (const node of ordered.filter(isDeadEnd)) {
    const seen = new Set<string>();
    let sourceId = node.parentNodeId ?? node.openerNodeId;

    while (sourceId !== null && !groupOf.has(sourceId) && !seen.has(sourceId)) {
      seen.add(sourceId);

      const source = byId.get(sourceId);

      sourceId = source === undefined ? null : (source.parentNodeId ?? source.openerNodeId);
    }

    groupOf.set(
      node.id,
      sourceId !== null && groupOf.has(sourceId)
        ? (groupOf.get(sourceId) as string)
        : `solo:${node.id}`,
    );
  }

  const groups = new Map<string, StoredNode[]>();

  for (const node of ordered) {
    const key = groupOf.get(node.id) as string;

    groups.set(key, [...(groups.get(key) ?? []), node]);
  }

  // Ordered by their earliest page, which `ordered` already gives.
  const members = [...groups.values()];
  const ids = matchClusterIdentity(
    members.map((group) => group.map(({ id }) => id)),
    previous,
    createId,
  );

  return {
    sessionId,
    algorithmVersion: CLUSTER_ALGORITHM_VERSION,
    configVersion: CLUSTER_CONFIG_VERSION,
    ...(usedSpaceId === undefined ? {} : { embeddingSpaceId: usedSpaceId }),
    computedAt: now,
    clusters: members.map((group, index) => ({
      id: ids[index] as string,
      label: readClusterLabel(group, entities),
      memberIds: group.map(({ id }) => id),
    })),
  };
};
