import { describePageSource } from "@/shared/describePageSource";
import { Button } from "@/shared/ui";

import type { ClusterSummaryView } from "../../types";

export interface ClusterSummariesProps {
  title: string;
  clusters: readonly ClusterSummaryView[];
  /** Whether a text-generation model is active, so summaries can be asked for. */
  canSummarize: boolean;
  /** Asks for a cluster's summary now. */
  onSummarize: (clusterId: string) => void;
  /** Marks a cited fact wrong (REQ-LIN-008). */
  onReject: (factIds: string[]) => void;
}

const formatTime = (epochMs: number): string => new Date(epochMs).toLocaleString();

/** One cluster: its summary with sources, or why it has none. */
function Cluster({
  cluster,
  canSummarize,
  onSummarize,
  onReject,
}: {
  cluster: ClusterSummaryView;
  canSummarize: boolean;
  onSummarize: (clusterId: string) => void;
  onReject: (factIds: string[]) => void;
}) {
  const { summary } = cluster;
  const summarizeLabel = summary === null ? "Summarize now" : "Refresh";

  return (
    <li
      data-testid="summary-cluster"
      data-cluster-id={cluster.clusterId}
      data-stale={summary?.isStale === true}
      className="border-b border-neutral-200 py-3 dark:border-neutral-800"
    >
      <header className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-medium">{cluster.label}</h2>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {cluster.factCount} facts
        </span>
        {canSummarize && cluster.factCount > 0 && (summary === null || summary.isStale) && (
          <Button
            data-testid="summary-summarize"
            disabled={cluster.isPending}
            onClick={() => {
              onSummarize(cluster.clusterId);
            }}
          >
            {cluster.isPending ? "Summarizing…" : summarizeLabel}
          </Button>
        )}
      </header>
      {cluster.factCount === 0 ? (
        <p data-testid="summary-no-facts" className="mt-1 text-sm">
          No facts were extracted for these pages yet.
        </p>
      ) : summary === null ? (
        <p data-testid="summary-none" className="mt-1 text-sm">
          Not summarized yet.
        </p>
      ) : (
        <div className={summary.isStale ? "opacity-50" : undefined}>
          {summary.isStale && (
            <p data-testid="summary-stale" className="mt-1 text-xs">
              Out of date: what was read has changed since this was written.
            </p>
          )}
          <ul className="mt-1 flex list-disc flex-col gap-2 pl-5 text-sm">
            {summary.statements.map((statement) => (
              <li key={statement.text} data-testid="summary-statement">
                <span>{statement.text}</span>
                <ul className="mt-1 flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
                  {statement.citations.map((citation) => (
                    <li key={citation.factId} data-testid="summary-citation">
                      <a href={citation.url} target="_blank" rel="noreferrer" className="underline">
                        {citation.pageTitle}
                      </a>
                      {describePageSource(citation) !== "" && (
                        <span data-testid="summary-citation-details">
                          {" "}
                          ({describePageSource(citation)})
                        </span>
                      )}
                      : <q>{citation.quote}</q>{" "}
                      <button
                        type="button"
                        data-testid="summary-reject"
                        className="cursor-pointer text-red-700 underline dark:text-red-400"
                        onClick={() => {
                          onReject([citation.factId]);
                        }}
                      >
                        Wrong
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Written by {summary.modelName}, {formatTime(summary.generatedAt)}
            {summary.omittedFactCount > 0 &&
              `, from a selection of the facts (${summary.omittedFactCount} left out)`}
          </p>
        </div>
      )}
    </li>
  );
}

/**
 * The session's clusters and their summaries (REQ-SYN-003): every statement
 * with the pages and quotes it rests on, a stale one dimmed with "Refresh"
 * (REQ-LIN-006). Takes no client, so a sidebar can host it as the page does.
 */
export function ClusterSummaries({
  title,
  clusters,
  canSummarize,
  onSummarize,
  onReject,
}: ClusterSummariesProps) {
  return (
    <section aria-labelledby="summaries-heading">
      <h1 id="summaries-heading" data-testid="summaries-title" className="text-lg font-semibold">
        Synthesis: {title}
      </h1>
      <h2 className="mt-2 font-medium">Summaries</h2>
      {!canSummarize && (
        <p data-testid="summaries-no-model" className="mt-1 text-sm">
          Turn on page summaries in the settings to write them.
        </p>
      )}
      {clusters.length === 0 ? (
        <p data-testid="summaries-no-clusters" className="mt-3 text-sm">
          No clusters yet.
        </p>
      ) : (
        <ul className="mt-2">
          {clusters.map((cluster) => (
            <Cluster
              key={cluster.clusterId}
              cluster={cluster}
              canSummarize={canSummarize}
              onSummarize={onSummarize}
              onReject={onReject}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
