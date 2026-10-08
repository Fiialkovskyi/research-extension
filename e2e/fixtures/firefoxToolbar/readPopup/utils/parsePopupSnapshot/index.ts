/** What the suite reads out of the rendered popup document. */
export interface PopupSnapshot {
  /** `moz-extension://…` address of the document the panel is showing. */
  uri: string;
  /** Text of the greeting element, or null when it is not in the document. */
  greeting: string | null;
  /** Whether the greeting occupies a non-zero box. */
  greetingVisible: boolean;
  /** Rendered width of the popup's panel element, in CSS pixels. */
  panelWidth: number;
  /** Computed background of the popup's panel element. */
  backgroundColor: string;
  /** Computed colour of the greeting text. */
  textColor: string;
}

/**
 * Parses the snapshot the popup document returned.
 *
 * @throws If the popup returned something other than a JSON string.
 */
export function parsePopupSnapshot(raw: unknown): PopupSnapshot {
  if (typeof raw !== "string") {
    throw new Error(`Expected the popup snapshot as a JSON string, got ${typeof raw}.`);
  }

  return JSON.parse(raw) as PopupSnapshot;
}
