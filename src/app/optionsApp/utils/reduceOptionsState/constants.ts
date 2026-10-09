import type { OptionsState } from "./types";

export const INITIAL_OPTIONS_STATE: OptionsState = {
  models: [],
  install: { status: "idle" },
  isBusy: false,
  // The software path is the default because it is the one every supported
  // platform has, and therefore the one the budgets are judged against.
  device: "wasm",
  probes: [],
  blockedOrigins: [],
};
