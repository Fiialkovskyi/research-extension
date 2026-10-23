/**
 * Builds the chrome-context script that reads the badge on the add-on's
 * toolbar button.
 *
 * Firefox puts a browser action's badge text in a `badge` attribute, and
 * removes it when the text is empty, so a missing attribute reads as no badge.
 * The element bearing the widget id is a wrapper around the action button in
 * current releases, which is where the attribute sits, so the wrapper's
 * descendants are read as well as the wrapper itself.
 */
export const buildToolbarBadgeReaderScript = (widgetId: string): string =>
  `const widget = document.getElementById(${JSON.stringify(widgetId)});
   const badged = widget?.hasAttribute("badge") ? widget : widget?.querySelector("[badge]");
   return badged?.getAttribute("badge") ?? "";`;
