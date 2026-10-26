import * as v from "valibot";

import { pageMetadataSchema } from "@/features/pageMetadata";
import { MAXIMUM_SNAPSHOT_BYTES } from "@/features/pageSnapshots";

/**
 * Messages a session page's observer sends the background.
 *
 * A map of their own, apart from the surfaces' requests: a content script may
 * send these and nothing else, and no surface may send these. Neither carries
 * a tab or node id; the background reads the sending tab from the browser.
 */
export const pageContentRequestSchemas = {
  /**
   * What the page saw since its last batch. `maxScroll` is a reading — the
   * deepest point so far — and `copyEvents` and `pasteEvents` counts since
   * the last batch.
   */
  "signal.batch": v.object({
    maxScroll: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
    copyEvents: v.pipe(v.number(), v.integer(), v.minValue(0)),
    pasteEvents: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
  /**
   * What the page says about itself in its head, sent once when the observer
   * starts. Unasked for: it is small, and wanted for every page.
   */
  "page.metadata": pageMetadataSchema,
  /** The page's readable text, asked for when its node became deep read. */
  "content.extracted": v.object({
    text: v.pipe(v.string(), v.maxBytes(MAXIMUM_SNAPSHOT_BYTES)),
    truncated: v.boolean(),
    extractorVersion: v.string(),
  }),
} as const;

/** The background's answers to a page. */
export const pageContentResponseSchemas = {
  "signal.recorded": v.object({}),
  "content.stored": v.object({}),
  "metadata.stored": v.object({}),
  /**
   * Nothing was recorded. `stop` when the tab is no longer a session tab, so
   * the page stops observing; otherwise the page is merely not its tab's
   * current one any more.
   */
  "signal.dropped": v.object({ stop: v.boolean() }),
} as const;

/** What the background asks of a page's observer. */
export const pageObserverRequestSchemas = {
  /** The page's node became deep read: send its readable text, once. */
  "content.extract": v.object({}),
  /** The session is being saved: send what is held now, without waiting for the timer. */
  "content.flush": v.object({}),
  /** The page was just added to a session: show the notice, naming it. */
  "pageNotice.show": v.object({ sessionTitle: v.pipe(v.string(), v.maxLength(500)) }),
} as const;

/** The observer's answers to the background. */
export const pageObserverResponseSchemas = {
  /** The request was taken; the text, if any, follows as `content.extracted`. */
  "content.extracting": v.object({}),
  /** What the page held has been sent, or there was nothing to send. */
  "content.flushed": v.object({}),
  /** The notice was handed to the page. */
  "pageNotice.shown": v.object({}),
} as const;
