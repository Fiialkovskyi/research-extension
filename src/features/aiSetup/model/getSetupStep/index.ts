import type { SetupStep, SetupStepInput } from "./types";

/**
 * The step the setup page shows, derived afresh from what the extension sees,
 * so it moves on by itself and skips whatever is already done.
 *
 * "Not installed" and "installed but closed" look the same from here — nothing
 * answers — so one step covers both. Allowing the extension appears only when
 * Ollama actually refuses it.
 */
export const getSetupStep = ({ server, isSetUp, isTurningOn }: SetupStepInput): SetupStep => {
  if (isTurningOn) {
    return "turningOn";
  }

  if (isSetUp) {
    return "done";
  }

  switch (server) {
    case "loading":
    case "notConnected":
      return "checking";
    case "unreachable":
      return "getOllama";
    case "refused":
      return "allowExtension";
    case "running":
      return "turnOn";
  }
};
