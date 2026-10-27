// Paths are relative to the repository root, where every `npm run` script starts.
export const FIXTURES_DIRECTORY = "evals/fixtures";
export const REPORTS_DIRECTORY = "evals/reports";
export const BASELINE_PATH = "evals/baseline.json";

/** The generation model when `EVAL_MODEL` does not name one: the setup page's recommendation. */
export const DEFAULT_EVAL_MODEL = "gemma4:12b";

/** The embedding model concept merging uses when `EVAL_EMBEDDING_MODEL` does not name one. */
export const DEFAULT_EVAL_EMBEDDING_MODEL = "nomic-embed-text";

/** What a page's server is told we are, as the page-capture command asks for it. */
export const CAPTURE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0";

/** How long the page-capture command waits for a page. */
export const CAPTURE_TIMEOUT_MS = 30_000;

/** The numbers a run reports, in the order the table shows them, with the label for each. */
export const METRIC_LABELS = {
  junkSubjectRate: "Facts dropped as junk (subject or value)",
  invalidAnswerRate: "Extraction answers that could not be read",
  truncatedAnswerRate: "Extraction answers cut off by the token limit",
  groundedRate: "Facts whose quote is on the page",
  labelRecall: "Labelled facts found",
  mergeRecall: "Concepts that should merge, merged",
  mergePrecision: "Concepts that should stay apart, apart",
  statementNamingRate: "Summary statements naming a product",
  statementComparingRate: "Summary statements naming two products or more",
  cardCount: "Product cards",
  durationSeconds: "Seconds",
  requestCount: "Requests to the model",
} as const;
