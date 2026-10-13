/**
 * Builds the script, evaluated in the Summaries page, that reports what it
 * shows: the empty state, the title, whether it asks for a generation model,
 * whether the comparison table says it has nothing yet,
 * and each cluster with its label, whether it has facts, and its statements.
 */
export const buildSummariesReaderScript = (): string => `
  const has = (root, id) => !!root.querySelector('[data-testid="' + id + '"]');
  return JSON.stringify({
    empty: has(document, "summaries-empty"),
    title: document.querySelector('[data-testid="summaries-title"]')?.textContent ?? null,
    needsModel: has(document, "summaries-no-model"),
    tableEmpty: has(document, "table-empty"),
    clusters: Array.from(document.querySelectorAll('[data-testid="summary-cluster"]'), (cluster) => ({
      label: cluster.querySelector("h2")?.textContent ?? "",
      hasNoFacts: has(cluster, "summary-no-facts"),
      statements: Array.from(
        cluster.querySelectorAll('[data-testid="summary-statement"] > span'),
        (statement) => statement.textContent ?? "",
      ),
    })),
  });
`;
