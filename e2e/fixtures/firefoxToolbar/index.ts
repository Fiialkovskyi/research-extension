/**
 * Drives the extension's toolbar action the way a person does, and reads the
 * popup it opens.
 *
 * Everything here runs in Firefox's *chrome* context, where the toolbar lives.
 * Three constraints shape these helpers, each documented where it bites:
 *
 * 1. The chrome context needs geckodriver's `--allow-system-access`, set in
 *    the `wdio:geckodriverOptions` capability (`enter-browser-chrome`).
 * 2. `browser.execute` and `$` route through BiDi and always land in the
 *    content realm, so privileged work uses the classic protocol commands
 *    `executeScript`, `findElement` and `performActions` (`click-toolbar-action`).
 * 3. The popup renders in a remote XUL `<browser>`, which BiDi does not report
 *    as a browsing context and whose `contentDocument` is null, so reading it
 *    goes through Firefox's Marionette actor (`read-popup`).
 *
 * The Firefox-internal ids, selectors and keys these rely on are in
 * `constants.ts`. This file is the public surface and holds no logic.
 */

export { clearSystemColourScheme } from "./clearSystemColourScheme";
export { clickToolbarAction } from "./clickToolbarAction";
export { closePopup } from "./closePopup";
export { enterBrowserChrome } from "./enterBrowserChrome";
export { leaveBrowserChrome } from "./leaveBrowserChrome";
export { placeToolbarAction } from "./placeToolbarAction";
export { type PopupPanelState, getPopupPanelState } from "./getPopupPanelState";
export { type PopupSnapshot, readPopup } from "./readPopup";
export { type SystemColourScheme, setSystemColourScheme } from "./setSystemColourScheme";
export { getToolbarWidgetId } from "./getToolbarWidgetId";
export { waitForPopupPanel } from "./waitForPopupPanel";
