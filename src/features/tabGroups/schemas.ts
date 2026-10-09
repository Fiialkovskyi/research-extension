import * as v from "valibot";

import { TAB_GROUP_COLORS, TAB_GROUP_TITLE_MAX_LENGTH } from "./constants";

/** A colour Firefox may give a tab group. */
export const tabGroupColorSchema = v.picklist(TAB_GROUP_COLORS);

/**
 * Starting a research session as a named tab group.
 *
 * The title is trimmed and checked here, at the protocol boundary, so a blank
 * one is refused before any tab exists rather than rolled back after.
 */
export const tabGroupRequestSchemas = {
  "tabGroup.create": v.object({
    title: v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty("A session needs a title."),
      v.maxLength(TAB_GROUP_TITLE_MAX_LENGTH),
    ),
  }),
} as const;

export const tabGroupResponseSchemas = {
  /** The group exists, titled, holding its one tab, which now has focus. */
  "tabGroup.created": v.object({
    groupId: v.number(),
    tabId: v.number(),
    title: v.string(),
    /** Assigned by Firefox; the extension reads it, never sets it. */
    color: tabGroupColorSchema,
  }),
  /** Creating the group failed, and the tab opened for it has been closed. */
  "tabGroup.failed": v.object({
    reason: v.string(),
  }),
} as const;
