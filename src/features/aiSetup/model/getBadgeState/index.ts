/** What the toolbar icon carries: nothing while AI works. */
export type BadgeState = "needsSetup" | "paused" | undefined;

/**
 * The toolbar badge: AI not set up comes first, since nothing it does works
 * yet; set up but waiting for Ollama is the quieter one.
 *
 * @param isPaused Local AI is waiting because Ollama did not answer.
 */
export const getBadgeState = (isSetUp: boolean, isPaused: boolean): BadgeState => {
  if (!isSetUp) {
    return "needsSetup";
  }

  return isPaused ? "paused" : undefined;
};
