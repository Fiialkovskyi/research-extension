/**
 * Page signals: what the user does on a session page — how far they scrolled,
 * whether they copied from it — observed by a script injected into session tabs
 * only, and recorded on the page's node.
 *
 * Active reading time is not here: it is measured in the background from the
 * browser's focus events (`tabCapture/trackActiveDwell`), so it works without
 * page access.
 */

// `model/observePage` is deliberately absent from this barrel. It runs in the
// page, and the background imports this barrel; the page observer's entrypoint
// imports it by path, so neither bundle carries the other's code.

export { BLOCKED_NOTICE_PATH, PAGE_ACCESS_ORIGINS, PAGE_OBSERVER_PATH } from "./constants";
export {
  pageContentRequestSchemas,
  pageContentResponseSchemas,
  pageObserverRequestSchemas,
  pageObserverResponseSchemas,
} from "./schemas";
export type { PageInjection, PageSender, PageSignalsApi } from "./types";
export { injectBlockedNotice } from "./model/injectBlockedNotice";
export { injectPageObserver } from "./model/injectPageObserver";
export { injectSessionTabs } from "./model/injectSessionTabs";
export { readSignalTarget } from "./model/readSignalTarget";
export type { SignalTarget } from "./model/readSignalTarget";
export { recordSignalBatch } from "./model/recordSignalBatch";
export type { SignalBatch } from "./model/recordSignalBatch";
