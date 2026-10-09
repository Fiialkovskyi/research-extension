/**
 * Firefox builds a DOM id for every extension's toolbar button out of the
 * add-on id: lowercased, every character outside `[a-z0-9_-]` replaced by an
 * underscore, with a `-browser-action` suffix.
 *
 * Reproducing that rule here is what lets the suite find the button in the
 * chrome DOM. It is kept as a pure function so the rule itself is covered by
 * unit tests rather than only observed through a live browser.
 */
export const getToolbarWidgetId = (extensionId: string): string => {
  return `${extensionId.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}-browser-action`;
};
