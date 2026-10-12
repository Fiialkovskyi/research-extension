import type { ENGAGEMENT_STATES } from "./constants";

/**
 * How each engagement state is shown on every surface: in words, and by a
 * marker whose shape — not only its colour — differs between states
 * (REQ-UI-002). One table, so the map and the sidebar cannot drift apart.
 */
export const ENGAGEMENT_DISPLAY: Record<
  (typeof ENGAGEMENT_STATES)[number],
  { words: string; marker: string }
> = {
  unread: { words: "unread", marker: "○" },
  skimmed: { words: "skimmed", marker: "◐" },
  deep_read: { words: "deep read", marker: "●" },
  dead_end: { words: "dead end", marker: "✕" },
};
