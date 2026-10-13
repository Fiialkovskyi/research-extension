import type { ChatMessage } from "@/features/inference";

import { FACT_EXTRACTION_PROMPT, PAGE_TEXT_CLOSE, PAGE_TEXT_OPEN } from "../../constants";

/**
 * Builds the request for one chunk (REQ-SYN-011): the prompt's instructions as
 * the system message, and the chunk's text as data between the page-text
 * delimiters. A closing delimiter already in the text is altered so the page
 * cannot end the block and speak outside it; grounding still compares quotes
 * against the original text.
 */
export const buildFactExtractionMessages = (chunkText: string): ChatMessage[] => [
  { role: "system", content: FACT_EXTRACTION_PROMPT.instructions },
  {
    role: "user",
    content: `${PAGE_TEXT_OPEN}\n${chunkText.replaceAll(PAGE_TEXT_CLOSE, "</page_text_>")}\n${PAGE_TEXT_CLOSE}`,
  },
];
