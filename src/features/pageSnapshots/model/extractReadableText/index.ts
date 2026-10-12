import { Readability } from "@mozilla/readability";

import { MAXIMUM_SNAPSHOT_BYTES } from "../../constants";
import { type TruncatedText, truncateUtf8Text } from "../truncateUtf8Text";

/** Collapses the whitespace markup leaves behind: one blank line at most between paragraphs. */
const cleanText = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/**
 * Extracts a page's readable text — its main content, without navigation,
 * scripts or styles — cut to the snapshot limit (REQ-CAP-006).
 *
 * Runs in the page. Readability rewrites the document it reads, so it is given
 * a copy: the page the user sees is never touched.
 *
 * @returns The text, or `undefined` when the page has no readable content.
 */
export const extractReadableText = (document: Document): TruncatedText | undefined => {
  const article = new Readability(document.cloneNode(true) as Document).parse();
  const text = cleanText(article?.textContent ?? "");

  return text === "" ? undefined : truncateUtf8Text(text, MAXIMUM_SNAPSHOT_BYTES);
};
