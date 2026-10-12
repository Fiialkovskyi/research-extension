/**
 * Builds the script, evaluated in the "What was recorded" page, that reports
 * what it shows: the empty state, the session's title, and each entry with the
 * values it displays and any page text shown.
 */
export const buildRecordedReaderScript = (): string => `
  const read = (root, id) => root.querySelector('[data-testid="' + id + '"]')?.textContent ?? null;
  return JSON.stringify({
    empty: !!document.querySelector('[data-testid="recorded-empty"]'),
    title: read(document, "recorded-title"),
    entries: Array.from(document.querySelectorAll('[data-testid="recorded-entry"]'), (entry) => ({
      nodeId: entry.dataset.nodeId,
      heading: entry.querySelector("h2")?.textContent ?? "",
      scroll: read(entry, "recorded-scroll"),
      copies: read(entry, "recorded-copies"),
      snapshot: read(entry, "recorded-snapshot"),
      vectors: read(entry, "recorded-vectors"),
      text: read(entry, "recorded-text"),
    })),
  });
`;
