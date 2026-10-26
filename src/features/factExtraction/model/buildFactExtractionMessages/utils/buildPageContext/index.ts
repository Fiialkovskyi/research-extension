import {
  PAGE_CONTEXT_CLOSE,
  PAGE_CONTEXT_FIELD_LIMIT,
  PAGE_CONTEXT_OPEN,
} from "../../../../constants";

/** What the page says it is: each part when known. */
export interface PageContext {
  title?: string;
  siteName?: string;
  productName?: string;
}

/** One line of the context: whitespace collapsed, cut to the limit, a closing delimiter altered. */
const cleanField = (value: string | undefined): string | undefined => {
  const collapsed = (value ?? "").replace(/\s+/gu, " ").trim();
  const cut = Array.from(collapsed).slice(0, PAGE_CONTEXT_FIELD_LIMIT).join("").trim();

  return cut === "" ? undefined : cut.replaceAll(PAGE_CONTEXT_CLOSE, "</page_context_>");
};

/**
 * Builds the block that tells the model what page a passage is from: title,
 * site and product, one line each, between the page-context delimiters. The
 * page wrote all of it, so it is data like the passage: cut short, on one
 * line, and unable to close the block.
 *
 * @returns The block, or `undefined` when nothing is known of the page.
 */
export const buildPageContext = ({
  title,
  siteName,
  productName,
}: PageContext): string | undefined => {
  const lines = [
    ["title", cleanField(title)],
    ["site", cleanField(siteName)],
    ["product", cleanField(productName)],
  ].flatMap(([label, value]) => (value === undefined ? [] : [`${label}: ${value}`]));

  return lines.length === 0
    ? undefined
    : `${PAGE_CONTEXT_OPEN}\n${lines.join("\n")}\n${PAGE_CONTEXT_CLOSE}`;
};
