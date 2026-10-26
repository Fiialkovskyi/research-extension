import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

import { extractReadableText } from "@/features/pageSnapshots/model/extractReadableText";
import { readPageMetadata } from "@/features/pageMetadata/model/readPageMetadata";
import { showPageNotice } from "@/features/pageNotice/model/showPageNotice";
import { observePage } from "@/features/pageSignals/model/observePage";

/**
 * The page observer, injected by the background into session tabs only.
 *
 * Registered at runtime and with no `matches`: it is never declared in the
 * manifest, so it runs in no page the background did not choose, and asks for
 * no host permission of its own (REQ-RT-001).
 *
 * Wiring only — the rules live in `features/pageSignals/model/observePage`.
 * The modules are imported by path: their barrels belong to the background.
 */
export default defineContentScript({
  registration: "runtime",
  main: () => {
    observePage({
      window,
      document,
      send: (message) => browser.runtime.sendMessage(message),
      onRequest: (listener) => {
        const handle = (message: unknown) => listener(message);

        browser.runtime.onMessage.addListener(handle);

        return () => {
          browser.runtime.onMessage.removeListener(handle);
        };
      },
      requestFrame: (callback) => {
        requestAnimationFrame(callback);
      },
      setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
      clearTimer: (handle) => {
        window.clearTimeout(handle);
      },
      extract: extractReadableText,
      readMetadata: readPageMetadata,
      showNotice: (sessionTitle) => {
        showPageNotice({
          document,
          sessionTitle,
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
