import { groupCitationsByPage } from "@/shared/groupCitationsByPage";
import { readSourceLabel } from "@/shared/readSourceLabel";

/** What a source line needs of a citation. */
export interface SourceCitation {
  factId: string;
  pageTitle: string;
  url: string;
  quote: string;
  siteName?: string | undefined;
  publishedDate?: string | undefined;
}

export interface SourceLinesProps {
  citations: readonly SourceCitation[];
  /** Marks a fact wrong (REQ-LIN-008). */
  onReject: (factIds: string[]) => void;
  /** The test id of a page's line, and of a quote's "Wrong". */
  lineTestId: string;
  rejectTestId: string;
}

/** One quote with its control to mark it wrong. */
function Quote({
  citation,
  onReject,
  rejectTestId,
}: {
  citation: SourceCitation;
  onReject: (factIds: string[]) => void;
  rejectTestId: string;
}) {
  return (
    <>
      <q>{citation.quote}</q>{" "}
      <button
        type="button"
        data-testid={rejectTestId}
        className="cursor-pointer text-red-700 underline dark:text-red-400"
        onClick={() => {
          onReject([citation.factId]);
        }}
      >
        Wrong
      </button>
    </>
  );
}

/**
 * The pages a statement or a value rests on, a line each: the site's name as
 * the link (the page's title as its tooltip), the day it was published, and the page's first
 * quote, with any others behind "N more quotes". Every quote can be marked
 * wrong.
 */
export function SourceLines({ citations, onReject, lineTestId, rejectTestId }: SourceLinesProps) {
  return (
    <ul className="mt-1 flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
      {groupCitationsByPage(citations).map(({ first, more }) => (
        <li key={first.factId} data-testid={lineTestId}>
          <a
            href={first.url}
            title={first.pageTitle}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {readSourceLabel(first)}
          </a>
          {first.publishedDate !== undefined && (
            <span data-testid="source-date"> ({first.publishedDate})</span>
          )}
          : <Quote citation={first} onReject={onReject} rejectTestId={rejectTestId} />
          {more.length > 0 && (
            <details className="mt-0.5">
              <summary className="cursor-pointer">
                {more.length} more {more.length === 1 ? "quote" : "quotes"}
              </summary>
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {more.map((citation) => (
                  <li key={citation.factId}>
                    <Quote citation={citation} onReject={onReject} rejectTestId={rejectTestId} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}
