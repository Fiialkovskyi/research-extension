import type { StoredNode } from "@/shared/storage";

import { MINIMUM_CLUSTER_ENTITY_FACTS } from "../../../../constants";
import type { ClusterEntity } from "../buildEntityEdges";

/** The entity most of whose facts the cluster's pages state, when it has enough of them. */
const readMainEntity = (
  members: readonly StoredNode[],
  entities: readonly ClusterEntity[],
): string | undefined => {
  const ids = new Set(members.map(({ id }) => id));
  const [main] = entities
    .map((entity) => ({
      name: entity.name,
      count: entity.pages
        .filter(({ nodeId }) => ids.has(nodeId))
        .reduce((sum, { factCount }) => sum + factCount, 0),
    }))
    .filter(({ count }) => count >= MINIMUM_CLUSTER_ENTITY_FACTS)
    .toSorted((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return main?.name;
};

/**
 * Names a cluster by the entity its pages state most facts about, when that is
 * at least three, or else by its earliest search's query, or else by its
 * earliest page's title, or its URL when the page reported no title.
 *
 * @param members The cluster's pages, earliest first.
 */
export const readClusterLabel = (
  members: readonly StoredNode[],
  entities: readonly ClusterEntity[] = [],
): string => {
  const entity = readMainEntity(members, entities);

  if (entity !== undefined && entity.trim() !== "") {
    return entity;
  }

  const search = members.find((node) => node.kind === "serp" && node.query !== undefined);

  if (search?.query !== undefined) {
    return search.query;
  }

  const [first] = members;

  if (first === undefined) {
    return "";
  }

  return first.title.trim() === "" ? first.url : first.title;
};
