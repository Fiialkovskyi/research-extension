import * as v from "valibot";

/** What the suite reads out of the rendered popup document. */
export const popupSnapshotSchema = v.object({
  /** `moz-extension://…` address of the document the panel is showing. */
  uri: v.string(),
  /** Text of the greeting element, or null when it is not in the document. */
  greeting: v.nullable(v.string()),
  /** Whether the greeting occupies a non-zero box. */
  greetingVisible: v.boolean(),
  /** Rendered width of the popup's panel element, in CSS pixels. */
  panelWidth: v.number(),
  /** Computed background of the popup's panel element. */
  backgroundColor: v.string(),
  /** Computed colour of the greeting text. */
  textColor: v.string(),
  /** Text announcing the active session, or null when the popup shows none. */
  activeSession: v.nullable(v.string()),
  /** Text naming the closed session a new start would end, or null when there is none. */
  closedSession: v.nullable(v.string()),
  /** Whether the popup offers the form that starts a session. */
  hasSessionForm: v.boolean(),
  /** Whether the popup offers to open the research map. */
  hasOpenMap: v.boolean(),
  /** Text giving the active session's recorded page count, or null without one. */
  pageCount: v.nullable(v.string()),
});
