import { browser, expect } from "@wdio/globals";

import {
  type ProbeRun,
  readLifetimeProbes,
  setBackgroundIdleTimeout,
  startLifetimeProbe,
} from "../fixtures/backgroundLifetime/utils";
import { enterBrowserChrome, leaveBrowserChrome } from "../fixtures/firefoxToolbar/utils";

/** Firefox's own idle timeout for an event page. */
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
/** Shortened so a run outlasts the timeout several times within seconds. */
const IDLE_TIMEOUT_MS = 8_000;
const HOLD_SECONDS = 20;

/**
 * Waits until the run has an outcome, reading it from a freshly opened options
 * page. A run the alarm may still resume counts once it has been resumed.
 */
const waitForOutcome = async (
  runId: string,
  timeoutMs: number,
  isSettled: (run: ProbeRun) => boolean = (run) => run.state !== "running",
): Promise<ProbeRun> => {
  let run: ProbeRun | undefined;

  await browser.waitUntil(
    async () => {
      run = (await readLifetimeProbes()).find((candidate) => candidate.runId === runId);
      // Leaving the page again, so reading does not keep the background alive.
      await browser.url("about:blank");

      return run !== undefined && isSettled(run);
    },
    { timeout: timeoutMs, interval: 5_000, timeoutMsg: `Run ${runId} never finished.` },
  );

  return run!;
};

/**
 * What each probe strategy is expected to do (spike M0-1, see the change's
 * Findings). The job runner's hold is the one the extension relies on, so a
 * Firefox release that stops counting its API call fails here rather than
 * losing jobs. `hostPage` is recorded, not required: it is not used.
 */
const EXPECTED: Record<string, ((run: ProbeRun) => void) | undefined> = {
  // The control: if this held, the harness could not see an unload at all.
  none: (run) => expect(run.state).toBe("stopped"),
  apiActivity: (run) => expect(run.state).toBe("completed"),
  jobRunner: (run) => expect(run.state).toBe("completed"),
  hostPage: undefined,
  wakeAndResume: (run) =>
    expect(run.state === "resumed" || run.text.includes("resumed")).toBe(true),
};

/**
 * How long the background event page lives through a long wait with no
 * extension page open, under each keep-alive strategy.
 */
describe("background lifetime with no extension page open", function () {
  this.timeout(240_000);

  before(async () => {
    await enterBrowserChrome();
    await setBackgroundIdleTimeout(IDLE_TIMEOUT_MS);
    await leaveBrowserChrome();
    // Firefox reads the timeout when the background starts, so the page that
    // is loaded now keeps the default. Leaving it idle until it is unloaded
    // makes every later wake use the shortened one.
    await browser.url("about:blank");
    await browser.pause(DEFAULT_IDLE_TIMEOUT_MS + 5_000);
  });

  after(async () => {
    await enterBrowserChrome();
    await setBackgroundIdleTimeout(undefined);
    await leaveBrowserChrome();
  });

  for (const [strategy, assertOutcome] of Object.entries(EXPECTED)) {
    it(`${assertOutcome === undefined ? "records" : "checks"} how a ${strategy} run holds`, async () => {
      const runId = await startLifetimeProbe(strategy, HOLD_SECONDS);

      await browser.pause(HOLD_SECONDS * 1000 + IDLE_TIMEOUT_MS);

      // A wake-up alarm fires no sooner than a minute ahead, so a resume is
      // waited for rather than the whole hold.
      const run = await waitForOutcome(runId, 180_000, (candidate) =>
        strategy === "wakeAndResume"
          ? candidate.state === "resumed" || candidate.text.includes("resumed")
          : candidate.state !== "running",
      );

      console.log(`[spike M0-1] ${strategy}: ${run.state} — ${run.text}`);
      assertOutcome?.(run);
    });
  }
});
