// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { buildRecordedReaderScript } from ".";

const read = (): Record<string, unknown> =>
  JSON.parse((new Function(buildRecordedReaderScript()) as () => string)());

afterEach(() => {
  document.body.innerHTML = "";
});

describe("buildRecordedReaderScript", () => {
  it("reports the empty state", () => {
    document.body.innerHTML =
      '<p data-testid="recorded-empty">No research session is recorded.</p>';

    expect(read()).toMatchObject({ empty: true, title: null, entries: [] });
  });

  it("reports each entry's values and any text shown", () => {
    document.body.innerHTML = `
      <h1 data-testid="recorded-title">What was recorded: Motors</h1>
      <li data-testid="recorded-entry" data-node-id="a">
        <h2>Mid-drive motors</h2>
        <dd data-testid="recorded-scroll">80%</dd>
        <dd data-testid="recorded-copies">1</dd>
        <dd data-testid="recorded-snapshot">12.0 KB</dd>
        <dd data-testid="recorded-vectors">0</dd>
        <pre data-testid="recorded-text">Sits at the cranks.</pre>
      </li>`;

    expect(read()).toEqual({
      empty: false,
      title: "What was recorded: Motors",
      entries: [
        {
          nodeId: "a",
          heading: "Mid-drive motors",
          scroll: "80%",
          copies: "1",
          snapshot: "12.0 KB",
          vectors: "0",
          text: "Sits at the cranks.",
        },
      ],
    });
  });
});
