// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { buildProbeReaderScript } from ".";

const read = (): unknown => JSON.parse((new Function(buildProbeReaderScript()) as () => string)());

afterEach(() => {
  document.body.innerHTML = "";
});

describe("buildProbeReaderScript", () => {
  it("reports no runs when the card lists none", () => {
    document.body.innerHTML = '<p data-testid="probe-none">No runs yet.</p>';

    expect(read()).toEqual([]);
  });

  it("reports each run's id, strategy, state and line, in the card's order", () => {
    document.body.innerHTML = `
      <li data-testid="probe-run" data-run-id="b" data-strategy="none" data-state="stopped">None: unloaded at 8 s of 20 s</li>
      <li data-testid="probe-run" data-run-id="a" data-strategy="apiActivity" data-state="completed">API activity: held 20 s</li>`;

    expect(read()).toEqual([
      { runId: "b", strategy: "none", state: "stopped", text: "None: unloaded at 8 s of 20 s" },
      { runId: "a", strategy: "apiActivity", state: "completed", text: "API activity: held 20 s" },
    ]);
  });
});
