import type { MapNode } from "@/features/researchMap";

/**
 * The session's pages opened but never looked at, oldest first: what the user
 * set aside to read later. Only open pages — a closed one cannot be read now.
 */
export const listUnreadPages = (nodes: readonly MapNode[]): MapNode[] =>
  nodes
    .filter((node) => node.engagement === "unread" && node.tabState === "open")
    .toSorted((first, second) => first.createdAt - second.createdAt);
