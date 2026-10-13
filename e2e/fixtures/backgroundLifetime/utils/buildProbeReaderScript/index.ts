/**
 * Builds the script, evaluated in the options page, that reports the probe
 * runs its Developer card lists, newest first.
 */
export const buildProbeReaderScript = (): string => `
  return JSON.stringify(
    Array.from(document.querySelectorAll('[data-testid="probe-run"]'), (run) => ({
      runId: run.dataset.runId ?? "",
      strategy: run.dataset.strategy ?? "",
      state: run.dataset.state ?? "",
      text: run.textContent ?? "",
    })),
  );
`;
