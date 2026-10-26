/**
 * Collapses the whitespace in a value a page wrote, and cuts it to `limit`
 * characters without leaving half a surrogate pair at the end.
 *
 * @returns The cleaned text, or `undefined` when nothing is left.
 */
export const cleanText = (value: string | null | undefined, limit: number): string | undefined => {
  const collapsed = (value ?? "").replace(/\s+/gu, " ").trim();

  if (collapsed === "") {
    return undefined;
  }

  const cut = Array.from(collapsed).slice(0, limit).join("").trim();

  return cut === "" ? undefined : cut;
};
