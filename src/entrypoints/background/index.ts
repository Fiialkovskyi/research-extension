import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";

import { createBackgroundApp } from "@/app/backgroundApp";
import { createInferenceWorker, INFERENCE_WORKER_PATH } from "@/features/inference";
import { NO_TAB_GROUP } from "@/features/researchSession";
import { collectPolicyViolations } from "@/shared/collectPolicyViolations";
import { openResearchDatabase } from "@/shared/storage";

/**
 * The background event page.
 *
 * Firefox runs an MV3 background from `background.scripts` as an event page, so
 * it can be unloaded at any time. Listeners are therefore registered
 * synchronously here, before any `await`: a listener attached later would miss
 * the very message that woke the page.
 *
 * Wiring only — the dispatch logic lives in `app/backgroundApp`, where it is
 * unit tested without a browser.
 */
/** `browser.sessions` as Firefox implements it, with the per-tab values. */
interface FirefoxSessions {
  getTabValue: (tabId: number, key: string) => Promise<unknown>;
  setTabValue: (tabId: number, key: string, value: unknown) => Promise<void>;
  removeTabValue: (tabId: number, key: string) => Promise<void>;
}

const firefoxSessions = browser.sessions as unknown as FirefoxSessions;

/** `tabs.onUpdated` with Firefox's filter argument, which the shared typings omit. */
interface FirefoxTabsOnUpdated {
  addListener: (
    listener: (tabId: number, changeInfo: { groupId?: number }) => void,
    filter: { properties: string[] },
  ) => void;
}

const firefoxTabsOnUpdated = browser.tabs.onUpdated as unknown as FirefoxTabsOnUpdated;

export default defineBackground(() => {
  // Attached before anything can fetch, so the first refusal is not missed.
  const policyViolations = collectPolicyViolations(document);

  const app = createBackgroundApp({
    createInferenceWorker: () =>
      createInferenceWorker(browser.runtime.getURL(INFERENCE_WORKER_PATH)),
    openDatabase: openResearchDatabase,
    policyViolations,
    // Bound so the extension's own fetch is used, under the package's policy.
    fetchResource: (...args) => fetch(...args),
    tabGroups: {
      createTab: (properties) => browser.tabs.create(properties),
      groupTabs: (options) => browser.tabs.group(options),
      updateGroup: (groupId, properties) => browser.tabGroups.update(groupId, properties),
      getGroup: (groupId) => browser.tabGroups.get(groupId),
      activateTab: (tabId) => browser.tabs.update(tabId, { active: true }),
      removeTab: (tabId) => browser.tabs.remove(tabId),
    },
    persistStorage: () => navigator.storage.persist(),
    sessionTabs: {
      // Firefox's per-tab session values, which the shared (Chrome) typings do
      // not declare. They need the `sessions` permission.
      getTabValue: (tabId, key) => firefoxSessions.getTabValue(tabId, key),
      setTabValue: (tabId, key, value) => firefoxSessions.setTabValue(tabId, key, value),
      removeTabValue: (tabId, key) => firefoxSessions.removeTabValue(tabId, key),
      groupTabs: (options) => browser.tabs.group(options),
      updateGroup: (groupId, properties) => browser.tabGroups.update(groupId, properties),
      getGroup: (groupId) => browser.tabGroups.get(groupId),
    },
  });

  browser.runtime.onMessage.addListener((message: unknown) => app.handleMessage(message));

  // A port is how a surface receives streamed progress, and keeping one open
  // while the surface is visible is also what this change observes about
  // event-page lifetime.
  browser.runtime.onConnect.addListener((port) => {
    app.attachPort(port);
  });

  // The session follows its group. These wake the page, so like every other
  // listener they are attached before anything is awaited.
  browser.tabGroups.onUpdated.addListener((group) => {
    void app.handleGroupUpdated(group);
  });
  // Every removal closes the session, whatever its cause, so Firefox's
  // `removeInfo` is not read.
  browser.tabGroups.onRemoved.addListener((group) => {
    void app.handleGroupRemoved(group);
  });
  // A restored group comes back under its own id; this is what reopens it.
  browser.tabGroups.onCreated.addListener((group) => {
    void app.handleGroupCreated(group);
  });
  // A restored tab: back inside its group, or on its own when the group is gone.
  browser.tabs.onCreated.addListener((tab) => {
    if (tab.id !== undefined) {
      void app.handleTabCreated({ id: tab.id, groupId: tab.groupId ?? NO_TAB_GROUP });
    }
  });
  // Filtered to group changes, so the page is not woken for every page load.
  firefoxTabsOnUpdated.addListener(
    (tabId, changeInfo) => {
      if (changeInfo.groupId !== undefined) {
        void app.handleTabGroupChanged({ id: tabId, groupId: changeInfo.groupId });
      }
    },
    { properties: ["groupId"] },
  );
  // After a restart the group may not have come back; the record is checked
  // against what session restore actually restored.
  browser.runtime.onStartup.addListener(() => {
    void app.reconcileSession();
  });
});
