// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildProbeStartScript } from ".";

const run = (strategy: string, holdSeconds: number): unknown =>
  (new Function(buildProbeStartScript(strategy, holdSeconds)) as () => unknown)();

afterEach(() => {
  document.body.innerHTML = "";
});

const renderForm = () => {
  document.body.innerHTML = `
    <select data-testid="probe-strategy"><option value="none">None</option><option value="hostPage">Host page</option></select>
    <input data-testid="probe-hold" type="number" value="120" />
    <button data-testid="probe-start">Start</button>`;

  const changes: string[] = [];
  const clicked = vi.fn();

  document.addEventListener("change", (event) => {
    changes.push((event.target as HTMLInputElement).value);
  });
  document.querySelector("button")?.addEventListener("click", clicked);

  return { changes, clicked };
};

describe("buildProbeStartScript", () => {
  it("replaces the strategy and hold, announces both, and presses Start", () => {
    const { changes, clicked } = renderForm();

    expect(run("hostPage", 20)).toBe(true);
    expect(document.querySelector("select")?.value).toBe("hostPage");
    expect(document.querySelector("input")?.value).toBe("20");
    expect(changes).toEqual(["hostPage", "20"]);
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it("names the element it could not find", () => {
    document.body.innerHTML = '<select data-testid="probe-strategy"></select>';

    expect(run("none", 20)).toBe("probe-hold");
  });
});
