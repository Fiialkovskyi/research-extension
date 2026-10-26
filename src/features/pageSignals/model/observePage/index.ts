import { EXTRACTOR_VERSION, type TruncatedText } from "@/features/pageSnapshots";
import { buildRpcMessage, parseRpcMessage } from "@/shared/rpc";

import { SIGNAL_FLUSH_INTERVAL_MS } from "../../constants";
import { pageContentResponseSchemas, pageObserverRequestSchemas } from "../../schemas";

/** Marks a page already observed, so a second injection adds no second observer. */
const OBSERVED_MARKER = "__researchGraphPageObserver";

/**
 * What the observer needs from the page and the extension, passed in so the
 * rules run under jsdom with fake time and no extension runtime.
 */
export interface PageObserverDependencies {
  window: Window;
  document: Document;
  /** Sends a message to the background and resolves with its answer. */
  send: (message: unknown) => Promise<unknown>;
  /**
   * Listens for the background's requests, and returns a function that stops
   * listening. A listener's non-`undefined` result is the answer.
   */
  onRequest: (listener: (message: unknown) => Promise<unknown> | undefined) => () => void;
  /** Runs a callback before the next frame is painted. */
  requestFrame: (callback: () => void) => void;
  setTimer: (callback: () => void, delayMs: number) => number;
  clearTimer: (handle: number) => void;
  /** Extracts the page's readable text, or `undefined` when it has none. */
  extract: (document: Document) => TruncatedText | undefined;
  /** Shows the notice that this page was added to the named session. */
  showNotice: (sessionTitle: string) => void;
}

type MarkedWindow = Window & { [OBSERVED_MARKER]?: boolean };

/**
 * Observes a session page: how far it was scrolled and how often it was
 * copied from and pasted into, sent to the background in batches (REQ-CAP-005), and its
 * readable text once, when the background asks for it (REQ-CAP-006).
 *
 * Kept cheap on the page's main thread: a scroll event only asks for a frame,
 * and the frame does the one layout read. The clipboard, the selection and
 * anything typed are never read; a copy or paste is counted, nothing more, and
 * only one the user made — a page cannot fake one.
 *
 * @returns A function that stops observing.
 */
export const observePage = (dependencies: PageObserverDependencies): (() => void) => {
  const { window, document, send, requestFrame, setTimer, clearTimer } = dependencies;
  const marked = window as MarkedWindow;

  if (marked[OBSERVED_MARKER] === true) {
    return () => undefined;
  }

  marked[OBSERVED_MARKER] = true;

  let maxScroll = 0;
  let sentScroll = 0;
  let copyEvents = 0;
  let pasteEvents = 0;
  let isFramePending = false;
  let timer: number | undefined;
  let hasExtracted = false;

  const readScroll = (): number => {
    const height = document.documentElement.scrollHeight;

    return height > 0 ? Math.min(1, (window.scrollY + window.innerHeight) / height) : 0;
  };

  /** Sends what is held now; resolves once it has been sent, or at once with nothing to send. */
  const flush = (): Promise<void> => {
    if (timer !== undefined) {
      clearTimer(timer);
      timer = undefined;
    }

    if (maxScroll <= sentScroll && copyEvents === 0 && pasteEvents === 0) {
      return Promise.resolve();
    }

    const batch = { maxScroll, copyEvents, pasteEvents };

    sentScroll = maxScroll;
    copyEvents = 0;
    pasteEvents = 0;

    return send(buildRpcMessage("signal.batch", batch)).then(
      (answer) => {
        try {
          const parsed = parseRpcMessage(answer, pageContentResponseSchemas);

          if (parsed.type === "signal.dropped" && parsed.payload.stop) {
            stop();
          }
        } catch {
          // An answer this page cannot read changes nothing it does.
        }
      },
      // The extension was reloaded or removed: this script is orphaned.
      () => {
        stop();
      },
    );
  };

  const schedule = (): void => {
    timer ??= setTimer(() => {
      void flush();
    }, SIGNAL_FLUSH_INTERVAL_MS);
  };

  const measure = (): void => {
    isFramePending = false;

    const scroll = readScroll();

    if (scroll > maxScroll) {
      maxScroll = scroll;
      schedule();
    }
  };

  const handleScroll = (): void => {
    if (!isFramePending) {
      isFramePending = true;
      requestFrame(measure);
    }
  };

  const handleCopy = (event: Event): void => {
    if (event.isTrusted) {
      copyEvents += 1;
      schedule();
    }
  };

  const handlePaste = (event: Event): void => {
    if (event.isTrusted) {
      pasteEvents += 1;
      schedule();
    }
  };

  const handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      void flush();
    }
  };

  const handlePageHide = (): void => {
    void flush();
  };

  const extractOnce = (): void => {
    if (hasExtracted) {
      return;
    }

    hasExtracted = true;

    const extracted = dependencies.extract(document);

    if (extracted !== undefined) {
      send(
        buildRpcMessage("content.extracted", { ...extracted, extractorVersion: EXTRACTOR_VERSION }),
      ).catch(() => undefined);
    }
  };

  const stopListening = dependencies.onRequest((message) => {
    let request;

    try {
      request = parseRpcMessage(message, pageObserverRequestSchemas);
    } catch {
      // Not for this observer.
      return undefined;
    }

    if (request.type === "content.flush") {
      return flush().then(() => buildRpcMessage("content.flushed", {}));
    }

    if (request.type === "pageNotice.show") {
      dependencies.showNotice(request.payload.sessionTitle);

      return Promise.resolve(buildRpcMessage("pageNotice.shown", {}));
    }

    extractOnce();

    return Promise.resolve(buildRpcMessage("content.extracting", {}));
  });

  // Capture phase for copy and paste, so a page that stops the event still has it counted.
  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("copy", handleCopy, true);
  window.addEventListener("paste", handlePaste, true);
  window.addEventListener("pagehide", handlePageHide);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  const stop = (): void => {
    window.removeEventListener("scroll", handleScroll);
    window.removeEventListener("copy", handleCopy, true);
    window.removeEventListener("paste", handlePaste, true);
    window.removeEventListener("pagehide", handlePageHide);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    stopListening();

    if (timer !== undefined) {
      clearTimer(timer);
      timer = undefined;
    }

    // A tab that rejoins the session is injected again and observed afresh.
    marked[OBSERVED_MARKER] = false;
  };

  // The part of the page in view before any scrolling counts too.
  handleScroll();

  return stop;
};
