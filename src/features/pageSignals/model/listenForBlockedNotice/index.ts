import { buildRpcMessage, parseRpcMessage } from "@/shared/rpc";

import { pageObserverRequestSchemas } from "../../schemas";

export interface BlockedNoticeDependencies {
  /**
   * Listens for the background's requests, and returns a function that stops
   * listening. A listener's non-`undefined` result is the answer.
   */
  onRequest: (listener: (message: unknown) => Promise<unknown> | undefined) => () => void;
  /** Shows the notice that the page's site is not tracked, naming the session. */
  showNotice: (sessionTitle: string) => void;
}

/**
 * Waits for the one request this script exists for: show the notice that the
 * page's site is not tracked. It answers nothing else, reads nothing from the
 * page and sends nothing to the background of its own accord.
 *
 * Imported by path by the blocked-notice entrypoint, like `observePage`.
 *
 * @returns A function that stops listening.
 */
export const listenForBlockedNotice = (dependencies: BlockedNoticeDependencies): (() => void) =>
  dependencies.onRequest((message) => {
    let request;

    try {
      request = parseRpcMessage(message, pageObserverRequestSchemas);
    } catch {
      // Not for this script.
      return undefined;
    }

    if (request.type !== "pageNotice.show" || request.payload.kind !== "blocked") {
      return undefined;
    }

    dependencies.showNotice(request.payload.sessionTitle);

    return Promise.resolve(buildRpcMessage("pageNotice.shown", {}));
  });
