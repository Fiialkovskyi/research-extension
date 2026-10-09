import * as v from "valibot";

/** What the toolbar action's panel is doing, and what it hangs from. */
export const popupPanelStateSchema = v.object({
  /** Firefox's panel state: `closed`, `showing`, `open`, `hiding`, `absent`. */
  state: v.string(),
  /** DOM id of the toolbar item the panel is anchored to, when it has one. */
  anchorId: v.nullable(v.string()),
});
