import { EGRESS_LOG_PROPERTY } from "../../constants";

/** Builds the chrome-context script that returns the recorded requests as JSON. */
export const buildEgressReaderScript = (): string => `
  const recorder = Services.appShell.hiddenDOMWindow.${EGRESS_LOG_PROPERTY};
  if (!recorder) {
    throw new Error("The egress recorder was never started.");
  }
  return JSON.stringify(recorder.log);
`;
