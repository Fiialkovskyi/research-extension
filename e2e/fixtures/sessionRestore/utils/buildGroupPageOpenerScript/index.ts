/**
 * Builds the asynchronous chrome-context script that opens `url` as a new tab
 * inside the group labelled `label`, and answers once the page has loaded.
 *
 * A session's first tab shows the new-tab page, which Firefox does not keep
 * when it is closed. A real page is what makes a session tab restorable.
 * Answers `{ ok: tabCount }` like the other asynchronous scripts, or
 * `{ error }` when the group is missing or the page does not load in time.
 */
export const buildGroupPageOpenerScript = (
  label: string,
  url: string,
  timeoutMs: number,
): string => {
  return `const done = arguments[arguments.length - 1];
    const group = (gBrowser.tabGroups ?? []).find((candidate) => candidate.label === ${JSON.stringify(label)});
    if (!group) { done(JSON.stringify({ error: ${JSON.stringify(`No tab group titled "${label}".`)} })); return; }
    const tab = gBrowser.addTab(${JSON.stringify(url)}, {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
    group.addTabs([tab]);
    const deadline = Date.now() + ${timeoutMs};
    const check = () => {
      const browser = tab.linkedBrowser;
      if (browser.currentURI.spec === ${JSON.stringify(url)} && !browser.webProgress?.isLoadingDocument) {
        done(JSON.stringify({ ok: group.tabs.length }));
      } else if (Date.now() > deadline) {
        done(JSON.stringify({ error: ${JSON.stringify(`The page ${url} never finished loading.`)} }));
      } else {
        setTimeout(check, 50);
      }
    };
    check();`;
};
