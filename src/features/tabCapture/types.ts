/** The parts of a browser tab capture reads. */
export interface CaptureTab {
  id: number;
  /** Present with the `tabs` permission. */
  url?: string;
  title?: string;
  /** `-1` or absent when the tab is in no group. */
  groupId?: number;
  openerTabId?: number;
  /** The window holding the tab; saving a session keeps that window open. */
  windowId?: number;
  incognito: boolean;
}

/**
 * The part of the browser's tab API capture uses.
 *
 * Declared structurally so every capture rule is exercised without an
 * extension runtime; the background entrypoint passes the real methods.
 */
export interface TabCaptureApi {
  /** Rejects when the tab no longer exists. */
  getTab: (tabId: number) => Promise<CaptureTab>;
  queryGroupTabs: (groupId: number) => Promise<CaptureTab[]>;
}

/** A committed navigation, as `webNavigation.onCommitted` reports it. */
export interface CommittedNavigation {
  tabId: number;
  /** `0` for the top frame. */
  frameId: number;
  url: string;
  transitionType: string;
}
