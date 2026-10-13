import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import type { ScriptPublicPath } from "wxt/utils/inject-script";

import { createBackgroundApp } from "@/app/backgroundApp";
import { SUMMARIES_PAGE_PATH } from "@/features/clusterSummaries";
import { HOLD_PAGE_PATH } from "@/features/diagnostics";
import { createInferenceWorker, INFERENCE_WORKER_PATH } from "@/features/inference";
import { JOB_WAKE_ALARM } from "@/features/jobQueue";
import { RECORDED_PAGE_PATH } from "@/features/recordedData";
import { MAP_PAGE_PATH, openMapTab, readMapTab } from "@/features/researchMap";
import { NO_TAB_GROUP } from "@/features/researchSession";
import { readCaptureTab, readFocusedTab } from "@/features/tabCapture";
import { ENGAGEMENT_RULES, LOCAL_INFERENCE_ORIGINS } from "@/shared/config";
import { buildRpcMessage } from "@/shared/rpc";
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
/** Selects a tab and brings its window to the front. */
const focusBrowserTab = async (tabId: number, windowId: number): Promise<void> => {
  await browser.tabs.update(tabId, { active: true });
  await browser.windows.update(windowId, { focused: true });
};

/** `browser.sessions` as Firefox implements it, with the per-tab values. */
interface FirefoxSessions {
  getTabValue: (tabId: number, key: string) => Promise<unknown>;
  setTabValue: (tabId: number, key: string, value: unknown) => Promise<void>;
  removeTabValue: (tabId: number, key: string) => Promise<void>;
}

const firefoxSessions = browser.sessions as unknown as FirefoxSessions;

/** This add-on's own pages, which speak to the background as surfaces. */
const EXTENSION_ORIGIN = browser.runtime.getURL("/");

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
    tabCapture: {
      getTab: async (tabId) => readCaptureTab(await browser.tabs.get(tabId)),
      queryGroupTabs: async (groupId) =>
        (await browser.tabs.query({ groupId })).map(readCaptureTab),
    },
    // Capture runs on browser events nobody is waiting on, so a failure is
    // reported where a developer inspecting the background will see it.
    reportError: (error) => {
      console.error("Research Graph:", error);
    },
    focusTab: async (tabId) => {
      const tab = await browser.tabs.get(tabId);

      await focusBrowserTab(tabId, tab.windowId ?? browser.windows.WINDOW_ID_CURRENT);
    },
    openMap: () =>
      openMapTab(
        {
          queryTabs: async () => (await browser.tabs.query({})).map(readMapTab),
          createTab: async (url) => readMapTab(await browser.tabs.create({ url })),
          focusTab: (tab) => focusBrowserTab(tab.id, tab.windowId),
          ungroupTab: (tabId) => browser.tabs.ungroup(tabId),
        },
        browser.runtime.getURL(MAP_PAGE_PATH),
      ),
    openRecordedPage: () =>
      openMapTab(
        {
          queryTabs: async () => (await browser.tabs.query({})).map(readMapTab),
          createTab: async (url) => readMapTab(await browser.tabs.create({ url })),
          focusTab: (tab) => focusBrowserTab(tab.id, tab.windowId),
          ungroupTab: (tabId) => browser.tabs.ungroup(tabId),
        },
        browser.runtime.getURL(RECORDED_PAGE_PATH),
      ),
    openSummariesPage: () =>
      openMapTab(
        {
          queryTabs: async () => (await browser.tabs.query({})).map(readMapTab),
          createTab: async (url) => readMapTab(await browser.tabs.create({ url })),
          focusTab: (tab) => focusBrowserTab(tab.id, tab.windowId),
          ungroupTab: (tabId) => browser.tabs.ungroup(tabId),
        },
        browser.runtime.getURL(SUMMARIES_PAGE_PATH),
      ),
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
    pageSignals: {
      // WXT types the path against the files it built; the observer's path is
      // one of them, which the build checks by emitting it.
      executeScript: ({ target, files }) =>
        browser.scripting.executeScript({ target, files: files as ScriptPublicPath[] }),
      requestPageText: (tabId) =>
        browser.tabs.sendMessage(tabId, buildRpcMessage("content.extract", {}), { frameId: 0 }),
      requestFlush: (tabId) =>
        browser.tabs.sendMessage(tabId, buildRpcMessage("content.flush", {}), { frameId: 0 }),
    },
    resumeApi: {
      // `discarded` opens a tab without loading its page; `title` is what it
      // shows meanwhile. Firefox takes both on `tabs.create`.
      createTab: (properties) => browser.tabs.create(properties),
      groupTabs: (options) => browser.tabs.group(options),
      updateGroup: (groupId, properties) => browser.tabGroups.update(groupId, properties),
      getGroup: (groupId) => browser.tabGroups.get(groupId),
      activateTab: (tabId) => browser.tabs.update(tabId, { active: true }),
      removeTab: (tabId) => browser.tabs.remove(tabId),
    },
    closeTabs: {
      queryWindowTabIds: async (windowId) =>
        (await browser.tabs.query({ windowId })).flatMap(({ id }) =>
          id === undefined ? [] : [id],
        ),
      createTabIn: (windowId) => browser.tabs.create({ windowId }),
      removeTabs: (tabIds) => browser.tabs.remove(tabIds),
    },
    hasOllamaAccess: () =>
      browser.permissions.contains({
        origins: LOCAL_INFERENCE_ORIGINS.map((origin) => `${origin}/*`),
      }),
    backgroundLifetime: {
      // Read-only and cheap: it exists only to count as activity.
      touch: () => browser.runtime.getPlatformInfo(),
      scheduleWake: async (at) => {
        if (at === undefined) {
          await browser.alarms.clear(JOB_WAKE_ALARM);
        } else {
          browser.alarms.create(JOB_WAKE_ALARM, { when: at });
        }
      },
      openHoldPage: async () => {
        const tab = await browser.tabs.create({
          url: browser.runtime.getURL(HOLD_PAGE_PATH),
          active: false,
        });

        if (tab.id === undefined) {
          throw new Error("The hold page opened without a tab id.");
        }

        return tab.id;
      },
      closeTab: (tabId) => browser.tabs.remove(tabId),
    },
    readIdleState: () => browser.idle.queryState(ENGAGEMENT_RULES.idleThresholdSeconds),
    readFocusedTab: () =>
      readFocusedTab({
        getLastFocusedWindow: () => browser.windows.getLastFocused(),
        queryIdleState: (seconds) => browser.idle.queryState(seconds),
        queryActiveTab: async (windowId) =>
          (await browser.tabs.query({ active: true, windowId }))[0],
      }),
  });

  // A message from a web page's top frame is the page observer's; it may send
  // only its own messages, and its tab is the browser's word. Everything else
  // comes from the add-on's own pages.
  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (
      sender.tab?.id !== undefined &&
      sender.frameId === 0 &&
      sender.url !== undefined &&
      !sender.url.startsWith(EXTENSION_ORIGIN)
    ) {
      return app.handleContentMessage(message, { tabId: sender.tab.id, url: sender.url });
    }

    return app.handleMessage(message);
  });

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
  // After a restart the group may not have come back; the record is checked
  // against what session restore actually restored. The same holds after an
  // install or update, during which the extension heard none of the tab events.
  browser.runtime.onStartup.addListener(() => {
    void app.reconcileSession();
  });
  browser.runtime.onInstalled.addListener(() => {
    void app.reconcileSession();
  });

  // Capture: what happens in the session's tabs becomes the graph. Each event
  // is forwarded as it arrives; the app runs them in that order.
  browser.webNavigation.onCommitted.addListener((details) => {
    void app.handleNavigationCommitted(details);
  });
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // A tab's session mark follows its group, so a restored tab is recognised.
    if (changeInfo.groupId !== undefined) {
      void app.handleTabGroupChanged({ id: tabId, groupId: changeInfo.groupId });
    }

    if (changeInfo.groupId !== undefined || changeInfo.title !== undefined) {
      void app.handleTabUpdated(readCaptureTab(tab), {
        ...(changeInfo.groupId === undefined ? {} : { groupId: changeInfo.groupId }),
        ...(changeInfo.title === undefined ? {} : { title: changeInfo.title }),
      });
    }
  });
  browser.tabs.onActivated.addListener(({ tabId }) => {
    void app.handleTabActivated(tabId);
  });
  browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
    void app.handleTabRemoved(tabId, removeInfo);
  });

  // Reading time: it counts only while Firefox is focused and the user is not
  // idle, so a change in either is followed like a tab switch.
  browser.idle.setDetectionInterval(ENGAGEMENT_RULES.idleThresholdSeconds);
  browser.windows.onFocusChanged.addListener(() => {
    void app.handleWindowFocusChanged();
  });
  browser.idle.onStateChanged.addListener((state) => {
    void app.handleIdleStateChanged(state);
  });
  // Page access granted from the popup: the pages already open are observed
  // without a reload.
  browser.permissions.onAdded.addListener(() => {
    void app.handlePermissionsAdded();
  });
  // Jobs wake the page themselves: an unload mid-job is recovered without
  // waiting for the user or a browser restart.
  browser.alarms.onAlarm.addListener(({ name }) => {
    void app.handleAlarm(name);
  });
});
