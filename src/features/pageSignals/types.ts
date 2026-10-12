/** Which tab and page a content message came from, as the browser reports it. */
export interface PageSender {
  tabId: number;
  /** The sending document's URL. */
  url: string;
}

/** A script injection, in the shape `scripting.executeScript` takes. */
export interface PageInjection {
  target: { tabId: number; frameIds: number[] };
  files: string[];
}

/**
 * The browser calls the page observer needs from the background.
 *
 * Declared structurally so injection is exercised without an extension
 * runtime; the background entrypoint passes the real methods.
 */
export interface PageSignalsApi {
  /** Rejects when the page may not be scripted: no access, or a restricted page. */
  executeScript: (injection: PageInjection) => Promise<unknown>;
  /** Asks a tab's observer for its page's text. Rejects when nothing listens. */
  requestPageText: (tabId: number) => Promise<unknown>;
}
