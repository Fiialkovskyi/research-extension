import { Button } from "@/shared/ui";

import type { OpenQuestionsView } from "../../types";

export interface SuggestedQuestionsProps {
  view: OpenQuestionsView;
  /** Runs a question's query as a search inside the session. */
  onSearch: (query: string) => void;
  /** Asks the model for questions now. */
  onSuggest: () => void;
}

/**
 * The questions the model suggests (REQ-SYN-008), labelled as suggestions,
 * each with "Search this"; dimmed with "Refresh" once the session's facts or
 * model changed. Takes no client, so a sidebar can host it as the page does.
 */
export function SuggestedQuestions({ view, onSearch, onSuggest }: SuggestedQuestionsProps) {
  const action = view.hasQuestions ? "Refresh" : "Suggest questions";
  const canAsk = view.canSuggest && (!view.hasQuestions || view.isStale);

  return (
    <section aria-labelledby="questions-heading" className="mt-6">
      <header className="flex flex-wrap items-center gap-3">
        <h2 id="questions-heading" className="text-lg font-semibold">
          Suggested questions
        </h2>
        {canAsk && (
          <Button data-testid="questions-suggest" disabled={view.isPending} onClick={onSuggest}>
            {view.isPending ? "Suggesting…" : action}
          </Button>
        )}
      </header>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Suggested by the model — check before relying on them.
      </p>
      {!view.canSuggest && !view.hasQuestions && (
        <p data-testid="questions-no-model" className="mt-1 text-sm">
          Turn on page summaries in the settings, and read a few pages, to get suggestions.
        </p>
      )}
      {view.hasQuestions && view.questions.length === 0 && (
        <p data-testid="questions-none" className="mt-1 text-sm">
          The model has nothing to suggest yet.
        </p>
      )}
      {view.questions.length > 0 && (
        <ul
          data-testid="questions-list"
          data-stale={view.isStale}
          className={`mt-1 flex flex-col gap-1 text-sm ${view.isStale ? "opacity-50" : ""}`}
        >
          {view.questions.map((question) => (
            <li
              key={question.question}
              data-testid="question"
              className="flex flex-wrap items-center gap-2"
            >
              <span>{question.question}</span>
              <Button
                data-testid="question-search"
                onClick={() => {
                  onSearch(question.query);
                }}
              >
                Search this
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
