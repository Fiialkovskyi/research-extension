import * as v from "valibot";

/** What the suite reads out of the rendered popup document. */
export const popupSnapshotSchema = v.object({
  /** `moz-extension://…` address of the document the panel is showing. */
  uri: v.string(),
  /** Whether the popup's panel occupies a non-zero box. */
  panelVisible: v.boolean(),
  /** Rendered width of the popup's panel element, in CSS pixels. */
  panelWidth: v.number(),
  /** Computed background of the popup's panel element. */
  backgroundColor: v.string(),
  /** Computed colour of the popup panel's text. */
  textColor: v.string(),
  /** Text announcing the active session, or null when the popup shows none. */
  activeSession: v.nullable(v.string()),
  /** The sessions the picker's select lists, recording ones first, as the options read. */
  sessionOptions: v.array(v.string()),
  /** Whether the popup offers to start a session: the title form, or the button that opens it. */
  hasSessionForm: v.boolean(),
  /** Whether the popup offers to open the research map. */
  hasOpenMap: v.boolean(),
  /** Text giving the active session's recorded page count, or null without one. */
  pageCount: v.nullable(v.string()),
  /** The details the session picker shows for the chosen saved session, as they read. */
  savedSessions: v.array(v.string()),
  /** "You left off at …", or null when the popup does not say it. */
  leftOff: v.nullable(v.string()),
  /** The offer to continue a saved session, or null when none is made. */
  reattachOffer: v.nullable(v.string()),
  /** The banner saying AI is not set up, or null when the popup shows none. */
  setupBanner: v.nullable(v.string()),
  /** Which state the AI activity strip is in, or null when the popup shows none. */
  activityState: v.nullable(v.string()),
  /** The AI activity strip's text, or null when the popup shows none. */
  activityStrip: v.nullable(v.string()),
});
