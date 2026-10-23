/** What the local Ollama server answered, as the setup page last heard it. */
export type SetupServerState = "loading" | "notConnected" | "unreachable" | "refused" | "running";

/** The one step the setup page shows. */
export type SetupStep =
  | "checking"
  | "getOllama"
  | "allowExtension"
  | "turnOn"
  | "turningOn"
  | "done";

export interface SetupStepInput {
  server: SetupServerState;
  /** An embedding model is active. */
  isSetUp: boolean;
  /** "Turn on AI" is running in the background. */
  isTurningOn: boolean;
}
