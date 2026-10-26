/**
 * Reads the `content` of the first `<meta>` in the page's head whose
 * `attribute` (`name` or `property`) is `key`, compared without regard to case.
 *
 * @returns The raw content, or `undefined` when there is no such tag.
 */
export const readMetaContent = (
  document: Document,
  attribute: "name" | "property",
  key: string,
): string | undefined => {
  for (const meta of document.head.querySelectorAll("meta")) {
    if (meta.getAttribute(attribute)?.toLowerCase() === key) {
      return meta.getAttribute("content") ?? undefined;
    }
  }

  return undefined;
};
