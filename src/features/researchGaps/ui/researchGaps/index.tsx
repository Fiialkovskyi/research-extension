import { Button } from "@/shared/ui";

import type { ResearchGap, ResearchGaps as Gaps } from "../../types";

export interface ResearchGapsProps {
  gaps: Gaps;
  /** Runs a gap's query as a search inside the session. */
  onSearch: (query: string) => void;
}

/** One gap, with the search that would fill it. */
function Gap({ gap, onSearch }: { gap: ResearchGap; onSearch: (query: string) => void }) {
  return (
    <li data-testid="gap" data-kind={gap.kind} className="flex flex-wrap items-center gap-2">
      <span>{gap.text}</span>
      <Button
        data-testid="gap-search"
        onClick={() => {
          onSearch(gap.query);
        }}
      >
        Search this
      </Button>
    </li>
  );
}

/**
 * What the session has not found yet (REQ-SYN-008): empty cells of the
 * things it compares, and kinds of source not read, each with "Search this"
 * (REQ-SYN-009). Takes no client, so a sidebar can host it as the page does.
 */
export function ResearchGaps({ gaps, onSearch }: ResearchGapsProps) {
  const isEmpty = gaps.cellGaps.length === 0 && gaps.categoryGaps.length === 0;

  return (
    <section aria-labelledby="gaps-heading" className="mt-6">
      <h2 id="gaps-heading" className="text-lg font-semibold">
        Gaps
      </h2>
      {isEmpty ? (
        <p data-testid="gaps-none" className="mt-1 text-sm">
          Nothing is missing that the session can tell.
        </p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1 text-sm">
          {[...gaps.cellGaps, ...gaps.categoryGaps].map((gap) => (
            <Gap key={`${gap.kind}:${gap.text}`} gap={gap} onSearch={onSearch} />
          ))}
          {gaps.moreCellGaps > 0 && (
            <li data-testid="gaps-more" className="text-xs text-neutral-500 dark:text-neutral-400">
              and {gaps.moreCellGaps} more with missing values
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
