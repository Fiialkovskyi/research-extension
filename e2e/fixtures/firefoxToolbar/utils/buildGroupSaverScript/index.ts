import { TAB_STATE_FLUSHER_MODULE } from "../../constants";

/**
 * Builds the privileged asynchronous script that saves the group labelled
 * `label` and closes it — Firefox's "Save and close group".
 *
 * Tab state is flushed to the session store first: saving reads it, and a page
 * that loaded moments ago would otherwise be saved as nothing. Resolves with
 * the group's internal id, or `null` when no group has the label.
 */
export const buildGroupSaverScript = (label: string): string => {
  return `const done = arguments[arguments.length - 1];
    const group = (gBrowser.tabGroups ?? []).find((candidate) => candidate.label === ${JSON.stringify(label)});
    if (!group) { done(JSON.stringify(null)); return; }
    const { TabStateFlusher } = ChromeUtils.importESModule(${JSON.stringify(TAB_STATE_FLUSHER_MODULE)});
    TabStateFlusher.flushWindow(window).then(() => {
      const id = group.id;
      group.saveAndClose();
      done(JSON.stringify(id));
    }, (error) => done(JSON.stringify({ error: String(error) })));`;
};
