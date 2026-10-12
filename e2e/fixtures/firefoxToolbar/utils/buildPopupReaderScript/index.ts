import { ACTOR_ERROR_PREFIX, POPUP_BROWSER_SELECTOR, UI_TIMEOUT_MS } from "../../constants";

/**
 * Script evaluated *inside* the popup document.
 *
 * It returns JSON rather than an object because the value crosses the
 * Marionette actor boundary, where only simple values survive reliably.
 */
export const POPUP_SNAPSHOT_SCRIPT = `
    const panel = document.querySelector('[data-testid="popup-panel"]');
    const greeting = document.querySelector('[data-testid="greeting"]');
    const rect = greeting?.getBoundingClientRect();
    const session = document.querySelector('[data-testid="session-active"]');
    const closedSession = document.querySelector('[data-testid="session-closed"]');
    return JSON.stringify({
      uri: document.documentURI,
      greeting: greeting?.textContent ?? null,
      greetingVisible: !!rect && rect.width > 0 && rect.height > 0,
      panelWidth: panel ? Math.round(panel.getBoundingClientRect().width) : 0,
      backgroundColor: panel ? getComputedStyle(panel).backgroundColor : "",
      textColor: greeting ? getComputedStyle(greeting).color : "",
      activeSession: session?.textContent ?? null,
      closedSession: closedSession?.textContent ?? null,
      hasSessionForm: !!document.querySelector('[data-testid="group-form"]'),
      hasOpenMap: !!document.querySelector('[data-testid="open-map"]'),
      pageCount: document.querySelector('[data-testid="session-page-count"]')?.textContent ?? null,
      treeRows: Array.from(document.querySelectorAll('[role="treeitem"]'), (row) => ({
        kind: row.dataset.rowKind,
        text: row.textContent,
        level: Number(row.getAttribute("aria-level")),
        expanded: row.getAttribute("aria-expanded"),
        engagement: row.dataset.engagement ?? null,
        tabState: row.dataset.tabState ?? null,
      })),
      unreadCount: document.querySelector('[data-testid="unread-count"]')?.textContent ?? null,
      unreadPages: Array.from(document.querySelectorAll('[data-testid="unread-page"]'), (entry) => entry.textContent),
    });
  `;

/**
 * Builds the privileged script that reaches into the popup document.
 *
 * The popup renders in a remote XUL `<browser>`: BiDi does not report it as a
 * browsing context and its `contentDocument` is null, so the only way in is
 * Firefox's own `MarionetteCommands` actor on the popup's window global. The
 * script resolves with `null` while the popup has not loaded, which lets the
 * caller poll, and with a prefixed string when the actor itself fails.
 */
export const buildPopupReaderScript = (
  innerScript: string = POPUP_SNAPSHOT_SCRIPT,
  selector: string = POPUP_BROWSER_SELECTOR,
): string => {
  return `const done = arguments[arguments.length - 1];
         const view = document.querySelector(${JSON.stringify(selector)});
         const global = view?.browsingContext?.currentWindowGlobal;
         if (!global || !global.documentURI.spec.startsWith("moz-extension://")) { done(null); return; }
         global.getActor("MarionetteCommands").sendQuery("MarionetteCommandsParent:executeScript", {
           script: ${JSON.stringify(innerScript)},
           args: [],
           opts: { sandboxName: "default", newSandbox: true, timeout: ${UI_TIMEOUT_MS}, file: "popup-reader", line: 0 },
         }).then(done, (error) => done(${JSON.stringify(ACTOR_ERROR_PREFIX)} + String(error)));`;
};
