// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { buildSummariesReaderScript } from ".";

const read = (): unknown =>
  JSON.parse((new Function(buildSummariesReaderScript()) as () => string)());

afterEach(() => {
  document.body.innerHTML = "";
});

describe("buildSummariesReaderScript", () => {
  it("reports the empty state", () => {
    document.body.innerHTML = '<p data-testid="summaries-empty">No research session.</p>';

    expect(read()).toEqual({
      empty: true,
      title: null,
      needsModel: false,
      tableEmpty: false,
      hasRejected: false,
      questionsNeedModel: false,
      gaps: [],
      clusters: [],
    });
  });

  it("reports each cluster, whether it has facts, and its statements", () => {
    document.body.innerHTML = `
      <h1 data-testid="summaries-title">Summaries: E-bikes</h1>
      <p data-testid="summaries-no-model">Turn on page summaries.</p>
      <ul>
        <li data-testid="summary-cluster"><h2>Motors</h2><p data-testid="summary-no-facts">None.</p></li>
        <li data-testid="summary-cluster"><h2>Bikes</h2>
          <ul><li data-testid="summary-statement"><span>Volta is lighter.</span></li></ul>
        </li>
      </ul>
      <p data-testid="table-empty">No entities with facts yet.</p>
      <p data-testid="table-rejected">1 value marked wrong</p>
      <p data-testid="questions-no-model">Turn on page summaries.</p>
      <ul><li data-testid="gap"><span>No reviews read yet</span><button>Search this</button></li></ul>`;

    expect(read()).toEqual({
      empty: false,
      title: "Summaries: E-bikes",
      needsModel: true,
      tableEmpty: true,
      hasRejected: true,
      questionsNeedModel: true,
      gaps: ["No reviews read yet"],
      clusters: [
        { label: "Motors", hasNoFacts: true, statements: [] },
        { label: "Bikes", hasNoFacts: false, statements: ["Volta is lighter."] },
      ],
    });
  });
});
