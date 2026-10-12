/**
 * Builds the privileged script that reopens a saved group in this window, as
 * choosing it from Firefox's list of saved groups does. Returns the reopened
 * group's internal id, or `null` when nothing was saved under that id.
 */
export const buildSavedGroupOpenerScript = (savedId: string): string => {
  return `if (!SessionStore.getSavedTabGroup(${JSON.stringify(savedId)})) { return JSON.stringify(null); }
    const group = SessionStore.openSavedTabGroup(${JSON.stringify(savedId)}, window);
    return JSON.stringify(group?.id ?? null);`;
};
