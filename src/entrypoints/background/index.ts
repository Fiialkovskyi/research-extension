import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";

import { createBackgroundApp } from "@/app/backgroundApp";
import { createInferenceWorker, INFERENCE_WORKER_PATH } from "@/features/inference";
import { collectPolicyViolations } from "@/shared/collectPolicyViolations";
import { openModelDatabase } from "@/shared/storage";

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
export default defineBackground(() => {
  // Attached before anything can fetch, so the first refusal is not missed.
  const policyViolations = collectPolicyViolations(document);

  const app = createBackgroundApp({
    createInferenceWorker: () =>
      createInferenceWorker(browser.runtime.getURL(INFERENCE_WORKER_PATH)),
    openDatabase: openModelDatabase,
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
  });

  browser.runtime.onMessage.addListener((message: unknown) => app.handleMessage(message));

  // A port is how a surface receives streamed progress, and keeping one open
  // while the surface is visible is also what this change observes about
  // event-page lifetime.
  browser.runtime.onConnect.addListener((port) => {
    app.attachPort(port);
  });
});
