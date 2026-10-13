/**
 * Firefox's idle timeout for an MV3 event page, in milliseconds (default
 * 30,000). Read live, so a change applies from the next idle period.
 */
export const IDLE_TIMEOUT_PREF = "extensions.background.idle.timeout";

/** The options page inside the package, where the probe card lives. */
export const OPTIONS_PAGE_PATH = "options.html";

/** How long to wait for the probe card to answer. */
export const PROBE_CARD_TIMEOUT_MS = 10_000;
