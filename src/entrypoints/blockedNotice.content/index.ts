import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

import { showPageNotice } from "@/features/pageNotice/model/showPageNotice";
import { listenForBlockedNotice } from "@/features/pageSignals/model/listenForBlockedNotice";

/**
 * The blocked-site notice, injected by the background into a session tab that
 * shows a page of a denylisted site, to say once that the site is not tracked.
 *
 * Registered at runtime and with no `matches`, like the page observer: the
 * manifest declares no content script and no host permission for it. It reads
 * nothing from the page and sends nothing to the background; it waits for the
 * one request to show the notice.
 *
 * Wiring only — the rules live in `features/pageSignals/model/listenForBlockedNotice`.
 */
export default defineContentScript({
  registration: "runtime",
  main: () => {
    listenForBlockedNotice({
      onRequest: (listener) => {
        const handle = (message: unknown) => listener(message);

        browser.runtime.onMessage.addListener(handle);

        return () => {
          browser.runtime.onMessage.removeListener(handle);
        };
      },
      showNotice: (sessionTitle) => {
        showPageNotice({
          document,
          sessionTitle,
          kind: "blocked",
          isDark: window.matchMedia("(prefers-color-scheme: dark)").matches,
          isReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
          clearTimer: (handle) => {
            window.clearTimeout(handle);
          },
        });
      },
    });
  },
});
