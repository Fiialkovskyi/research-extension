import { TAB_STATE_FLUSHER_MODULE } from "../../constants";

/**
 * Builds an asynchronous chrome-context script that runs `body` only after
 * every tab of the window has flushed its session history to the parent.
 *
 * Without the flush, Firefox's cached state of a freshly loaded tab is still
 * empty, so "save and close" silently saves nothing and the group lands among
 * the closed groups instead — which is what made the `spike-tab-groups` spike conclude
 * that saved groups could not be reproduced. A person never hits this, because
 * the state has long been collected by the time they close a group.
 *
 * `body` may `await` and `return` a value; the script answers it as JSON, or
 * `{ error }` if it throws.
 */
export const buildFlushedChromeScript = (body: string): string => {
  return `const done = arguments[arguments.length - 1];
    const { TabStateFlusher } = ChromeUtils.importESModule(${JSON.stringify(TAB_STATE_FLUSHER_MODULE)});
    TabStateFlusher.flushWindow(window)
      .then(async () => { ${body} })
      .then(
        (value) => done(JSON.stringify({ ok: value ?? null })),
        (error) => done(JSON.stringify({ error: String(error) })),
      );`;
};
