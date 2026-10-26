import type { SessionTotals } from "../../../../types";

/** "14 pages read · facts from 12 · 3 summaries", leaving out what is absent. */
export const describeTotals = ({ pagesRead, factsFrom, summaries }: SessionTotals): string =>
  [
    pagesRead === undefined ? undefined : `${pagesRead} ${pagesRead === 1 ? "page" : "pages"} read`,
    factsFrom === undefined ? undefined : `facts from ${factsFrom}`,
    summaries === undefined
      ? undefined
      : `${summaries} ${summaries === 1 ? "summary" : "summaries"}`,
  ]
    .filter((part) => part !== undefined)
    .join(" · ");
