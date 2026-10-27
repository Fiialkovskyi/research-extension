import type { PageMetadata } from "@/features/pageMetadata";
// Imported by path, as the content script does: these run on a page's document, so the
// feature barrels leave them out.
import { readPageMetadata } from "@/features/pageMetadata/model/readPageMetadata";
import { extractReadableText } from "@/features/pageSnapshots/model/extractReadableText";

/** A page as the extension reads it: its readable text, and what its head says about it. */
export interface ReadPage {
  text: string | undefined;
  metadata: PageMetadata | undefined;
}

/**
 * Reads a saved page the way the content script reads a live one, with the same
 * two functions, so what the model is given is what a session would give it. It
 * needs a DOM, which the eval run gets from its test environment.
 */
export const readPageForEvals = (html: string): ReadPage => {
  const document = new DOMParser().parseFromString(html, "text/html");

  return { text: extractReadableText(document)?.text, metadata: readPageMetadata(document) };
};
