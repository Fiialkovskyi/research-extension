/**
 * Tab groups as research sessions.
 *
 * A session is one Firefox tab group: its tabs are the session's tabs and its
 * title is the session's name. This module starts one; following it afterwards
 * belongs to a later change.
 */

// `ui/` is deliberately absent from this barrel: its components stay out of it so that
// the background, which imports feature barrels and has no use for React, never pulls React in.
// The surface that renders a component imports it from `ui/` by path.

export { TAB_GROUP_COLORS, TAB_GROUP_TITLE_MAX_LENGTH } from "./constants";
export { tabGroupRequestSchemas, tabGroupResponseSchemas } from "./schemas";
export { createTabGroup } from "./model/createTabGroup";
export type {
  CreatedTabGroup,
  TabGroupApi,
  TabGroupColor,
  TabGroupRequestType,
  TabGroupResponseType,
} from "./types";
