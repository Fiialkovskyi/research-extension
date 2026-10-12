import { ENGAGEMENT_RULES } from "@/shared/config";

/**
 * The browser calls that tell which tab the user is reading.
 *
 * Declared structurally so the rule is exercised without an extension
 * runtime; the background entrypoint passes the real methods.
 */
export interface FocusApi {
  /** The window that last had focus, and whether it has it still. */
  getLastFocusedWindow: () => Promise<{ id?: number; focused: boolean }>;
  /** `idle.queryState`: whether input arrived within the last `seconds`. */
  queryIdleState: (seconds: number) => Promise<string>;
  /** The selected tab of a window. */
  queryActiveTab: (windowId: number) => Promise<{ id?: number } | undefined>;
}

/**
 * The tab the user is reading now: the selected tab of the focused window,
 * while the user is not idle (target spec §4, "Focus and active time").
 *
 * Asked of the browser each time instead of being followed from events, so a
 * woken background knows it without having heard what happened while it slept.
 *
 * @returns The tab's id, or `undefined` when Firefox is not focused or the
 *   user is idle or away.
 */
export const readFocusedTab = async (api: FocusApi): Promise<number | undefined> => {
  const [window, idleState] = await Promise.all([
    api.getLastFocusedWindow(),
    api.queryIdleState(ENGAGEMENT_RULES.idleThresholdSeconds),
  ]);

  if (!window.focused || window.id === undefined || idleState !== "active") {
    return undefined;
  }

  return (await api.queryActiveTab(window.id))?.id;
};
