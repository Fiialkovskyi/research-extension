import type { ChatMessage } from "@/features/inference";

import { FACT_EXTRACTION_PROMPT, PAGE_TEXT_CLOSE, PAGE_TEXT_OPEN } from "../../constants";
import { buildPageContext, type PageContext } from "./utils/buildPageContext";

/**
 * Builds the request for one chunk (REQ-SYN-011): the prompt's instructions as
 * the system message, and, as the user message, what the page says it is
 * (when anything is known) followed by the chunk's text as data between the
 * page-text delimiters. A closing delimiter already in either is altered so
 * the page cannot end the block and speak outside it; grounding still compares
 * quotes against the original text.
 */
export const buildFactExtractionMessages = (
  chunkText: string,
  context: PageContext = {},
): ChatMessage[] => {
  const pageContext = buildPageContext(context);
  const passage = `${PAGE_TEXT_OPEN}\n${chunkText.replaceAll(PAGE_TEXT_CLOSE, "</page_text_>")}\n${PAGE_TEXT_CLOSE}`;

  return [
    { role: "system", content: FACT_EXTRACTION_PROMPT.instructions },
    { role: "user", content: pageContext === undefined ? passage : `${pageContext}\n\n${passage}` },
  ];
};
