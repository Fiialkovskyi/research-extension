import { NOTICE_DURATION_MS, NOTICE_FADE_MS } from "../../constants";
import { buildNotice } from "./utils/buildNotice";

export interface ShowPageNoticeOptions {
  document: Document;
  sessionTitle: string;
  /** The page prefers a dark colour scheme. */
  isDark: boolean;
  /** The user prefers no motion: the notice appears and goes without a fade. */
  isReducedMotion: boolean;
  setTimer: (callback: () => void, delayMs: number) => number;
  clearTimer: (handle: number) => void;
}

/** What is showing in a document now, so a newer notice can replace it. */
interface Showing {
  host: HTMLElement;
  timers: number[];
}

const showing = new WeakMap<Document, Showing>();

/** Removes the notice a document shows, and the timers that were to finish it. */
const dismiss = (document: Document, clearTimer: (handle: number) => void): void => {
  const current = showing.get(document);

  if (current === undefined) {
    return;
  }

  current.timers.forEach(clearTimer);
  current.host.remove();
  showing.delete(document);
};

/**
 * Shows the notice that a page was added to research, in the page's top-right
 * corner, for a few seconds. A notice still showing is replaced, not stacked.
 *
 * The notice sits in a closed shadow root, so the page cannot read the session's
 * title or restyle it; it takes no focus and no pointer events, so it cannot
 * trap a click or a key. Its text is put in after it is attached, which is what
 * makes a screen reader announce a live region.
 */
export const showPageNotice = (options: ShowPageNoticeOptions): void => {
  const { document, sessionTitle, isDark, isReducedMotion, setTimer, clearTimer } = options;

  dismiss(document, clearTimer);

  const host = document.createElement("research-graph-notice");
  const root = host.attachShadow({ mode: "closed" });
  const notice = buildNotice({ document, sessionTitle, isDark });
  const content = Array.from(notice.childNodes);
  const current: Showing = { host, timers: [] };

  Object.assign(host.style, {
    all: "initial",
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: "2147483647",
    pointerEvents: "none",
    opacity: isReducedMotion ? "1" : "0",
    transition: isReducedMotion ? "none" : `opacity ${NOTICE_FADE_MS}ms ease`,
  });
  notice.replaceChildren();
  root.append(notice);
  (document.documentElement ?? document.body).append(host);
  showing.set(document, current);

  current.timers.push(
    setTimer(() => {
      notice.append(...content);
      host.style.opacity = "1";
    }, 50),
    setTimer(() => {
      if (isReducedMotion) {
        dismiss(document, clearTimer);

        return;
      }

      host.style.opacity = "0";
      current.timers.push(setTimer(() => dismiss(document, clearTimer), NOTICE_FADE_MS));
    }, NOTICE_DURATION_MS),
  );
};
