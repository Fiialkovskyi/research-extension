import { ENTITY_EDGE_WEIGHT, MINIMUM_CLUSTER_ENTITY_FACTS } from "../../../../constants";
import type { WeightedPair } from "../buildSemanticEdges";

/** An entity the session resolved, with the pages that state facts about it. */
export interface ClusterEntity {
  name: string;
  /** Its facts in all, the ones the user did not mark wrong. */
  factCount: number;
  /** The pages that state them, and how many of the facts each states. */
  pages: readonly { nodeId: string; factCount: number }[];
}

/**
 * Joins the pages that state facts about the same entity (REQ-CLU-002's
 * companion): for each entity with at least {@link MINIMUM_CLUSTER_ENTITY_FACTS}
 * facts, its pages in the order `memberIds` gives, each to the next, so an
 * entity on `n` pages adds `n - 1` edges and not every pair. Only the entities'
 * pages that are members count; no name, type or language is looked at.
 *
 * @param memberIds The pages clustering places, in the order they were recorded.
 */
export const buildEntityEdges = (
  memberIds: readonly string[],
  entities: readonly ClusterEntity[],
): WeightedPair[] => {
  const members = new Set(memberIds);

  return entities.flatMap((entity) => {
    if (entity.factCount < MINIMUM_CLUSTER_ENTITY_FACTS) {
      return [];
    }

    const stating = new Set(entity.pages.map(({ nodeId }) => nodeId));
    const chain = memberIds.filter((id) => members.has(id) && stating.has(id));

    return chain.slice(1).map((to, index) => ({
      from: chain[index] as string,
      to,
      weight: ENTITY_EDGE_WEIGHT,
    }));
  });
};
