/**
 * Drives the extension's toolbar action the way a person does, and reads the
 * popup it opens.
 *
 * Everything here runs in Firefox's *chrome* context, where the toolbar lives.
 * Three constraints shape these helpers, each documented where it bites:
 *
 * 1. The chrome context needs geckodriver's `--allow-system-access`, set in
 *    the `wdio:geckodriverOptions` capability (`enterBrowserChrome`).
 * 2. `browser.execute` and `$` route through BiDi and always land in the
 *    content realm, so privileged work uses the classic protocol commands
 *    `executeScript`, `findElement` and `performActions` (`clickToolbarAction`).
 * 3. The popup renders in a remote XUL `<browser>`, which BiDi does not report
 *    as a browsing context and whose `contentDocument` is null, so reading it
 *    goes through Firefox's Marionette actor (`readPopup`).
 *
 * The Firefox-internal ids, selectors and keys these rely on are in
 * `constants.ts`. This file is the public surface and holds no logic.
 */

export { clearSystemColorScheme } from "./clearSystemColorScheme";
export { clickToolbarAction } from "./clickToolbarAction";
export { closePopup } from "./closePopup";
export { closeTabGroup } from "./closeTabGroup";
export { enterBrowserChrome } from "./enterBrowserChrome";
export { leaveBrowserChrome } from "./leaveBrowserChrome";
export { placeToolbarAction } from "./placeToolbarAction";
export { type PopupPanelState, getPopupPanelState } from "./getPopupPanelState";
export { type PopupSnapshot, readPopup } from "./readPopup";
export { type TabGroupSnapshot, readTabGroups } from "./readTabGroups";
export { type SystemColorScheme, setSystemColorScheme } from "./setSystemColorScheme";
export { getToolbarWidgetId } from "./getToolbarWidgetId";
export { submitPopupGroupTitle } from "./submitPopupGroupTitle";
export { waitForPopupPanel } from "./waitForPopupPanel";
