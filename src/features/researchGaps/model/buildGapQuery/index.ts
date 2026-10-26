import { CATEGORY_GAP_TEXT, MAXIMUM_QUERY_LENGTH } from "../../constants";
import type { GapCategory, ResearchGap } from "../../types";
import type { CellGap } from "../findCellGaps";

/** Trims a query to its limit, at a word where it can. */
const trimQuery = (query: string): string => {
  const clean = query.replaceAll(/\s+/gu, " ").trim();

  if (clean.length <= MAXIMUM_QUERY_LENGTH) {
    return clean;
  }

  const cut = clean.slice(0, MAXIMUM_QUERY_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");

  return lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
};

/**
 * Phrases a gap and the search that would fill it (REQ-SYN-009): an
 * entity's missing values searches the entity and its first missing
 * attributes, one search for the entity; a missing category searches
 * the session's subject — its main entity, or its title — with a word for
 * the category.
 */
export const buildGapQuery = (
  gap: { kind: "cell"; cell: CellGap } | { kind: "category"; category: GapCategory },
  subject: string,
): ResearchGap => {
  if (gap.kind === "cell") {
    const { entity, attributes, moreCount } = gap.cell;

    return {
      kind: "cell",
      text: `No ${attributes.join(", ")}${moreCount > 0 ? ` and ${moreCount} more` : ""} for ${entity}`,
      query: trimQuery(`${entity} ${attributes.join(" ")}`),
    };
  }

  const { text, word } = CATEGORY_GAP_TEXT[gap.category];

  return { kind: "category", text, query: trimQuery(`${subject} ${word}`) };
};
