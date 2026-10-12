/** Escapes text for an HTML text node or attribute. */
const escapeHtml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * Builds the results page the page server answers a search host with: titled
 * after the query, with one result, page A on the loopback origin, opening in
 * a new tab as a result opened from a search would.
 */
export const buildSearchResultsPage = (query: string, loopbackOrigin: string): string => {
  const shown = escapeHtml(query);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${shown} - Search</title>
  </head>
  <body>
    <p>Results for ${shown}.</p>
    <p><a id="first-result" href="${escapeHtml(loopbackOrigin)}/a.html" target="_blank">Page A</a></p>
  </body>
</html>
`;
};
