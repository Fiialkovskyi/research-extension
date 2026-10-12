import type { IDBPDatabase } from "idb";

import type { InferenceWorker } from "@/features/inference";
import type { PageSender, PageSignalsApi } from "@/features/pageSignals";
import type { SessionTab, SessionTabApi } from "@/features/researchSession";
import type { CaptureTab, CommittedNavigation, TabCaptureApi } from "@/features/tabCapture";
import type { TabGroupApi } from "@/features/tabGroups";
import type { PolicyViolationLog } from "@/shared/collectPolicyViolations";
import type { RpcMessage } from "@/shared/rpc";
import type { ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Composition root for the background context.
 *
 * The background is the extension's only coordinator: it owns the inference
 * worker and is the only context that writes local storage. Surfaces send it
 * intents and render what comes back.
 *
 * Everything the browser provides arrives as a dependency, so the whole
 * dispatch path is exercised in unit tests without an extension runtime. The
 * entrypoint does nothing but supply the real implementations.
 */
export interface BackgroundDependencies {
  /** Spawns the inference worker. Called at most once, on first need. */
  createInferenceWorker: () => InferenceWorker;
  /** Opens the add-on's database. Called at most once, on first need. */
  openDatabase: () => Promise<IDBPDatabase<ResearchDatabaseSchema>>;
  fetchResource: typeof fetch;
  /**
   * What the content security policy has refused.
   *
   * Attached in this context because violations are reported where they
   * occur, and this is the context that fetches model files — a listener on a
   * surface would never see them.
   */
  policyViolations: PolicyViolationLog;
  /** The browser's tab and tab group calls, used to start and follow a session. */
  tabGroups: TabGroupApi;
  /** Per-tab session values and grouping, used to bring restored session tabs back. */
  sessionTabs: SessionTabApi;
  /**
   * Asks the browser not to evict the database under storage pressure
   * (REQ-STO-009). The browser may decline; a session starts either way.
   */
  persistStorage: () => Promise<boolean>;
  /** The browser's tab lookups, used to capture the session's pages. */
  tabCapture: TabCaptureApi;
  /**
   * Reports a failure no surface asked about, such as a capture event that
   * could not be recorded. Nothing waits on these, so without a report they
   * would vanish.
   */
  reportError: (error: unknown) => void;
  /** Selects a tab and focuses its window, for a node activated on the map. */
  focusTab: (tabId: number) => Promise<void>;
  /** Selects the map's tab, opening one outside any tab group if none is open. */
  openMap: () => Promise<void>;
  /** Injects the page observer and asks it for a page's text. */
  pageSignals: PageSignalsApi;
  /**
   * The tab the user is reading now: the selected tab of the focused window,
   * while the user is not idle. `undefined` when Firefox is not focused or the
   * user is idle. Asked afresh each time, so nothing about focus lives only in
   * the memory of an event page that may be unloaded.
   */
  readFocusedTab: () => Promise<number | undefined>;
  /** The current time. Injected so reading time is exercised without waiting. */
  now?: () => number;
}

/** What the browser reports about the user's activity. */
export type IdleState = "active" | "idle" | "locked";

/** The changes of a tab update that capture follows. */
export interface TabChanges {
  groupId?: number;
  title?: string;
}

/** What a tab group event reports about the group. */
export interface GroupEventDetails {
  id: number;
  title?: string;
}

/**
 * The part of a runtime port this app uses.
 *
 * Declared structurally so the relay is exercised without an extension
 * runtime; the real port satisfies it.
 */
export interface BackgroundPort {
  postMessage: (message: unknown) => void;
  onMessage: { addListener: (listener: (message: unknown) => void) => void };
  /** Fires when the surface's page goes away, ending anything it subscribed to. */
  onDisconnect: { addListener: (listener: () => void) => void };
}

/** Sends a message that is not the answer to a request, such as progress. */
export type Emit = (message: RpcMessage<string, unknown>) => void;

export interface BackgroundApp {
  /**
   * Validates an untrusted message from a surface and answers it.
   *
   * One-shot messaging carries no intermediate updates, so progress a handler
   * would stream is dropped. A surface that wants it connects a port.
   */
  handleMessage: (candidate: unknown) => Promise<RpcMessage<string, unknown>>;
  /**
   * Serves a surface's long-lived connection, answering on the same port.
   *
   * A port rather than one-shot messages because progress has to stream while
   * work is still running — an install reports bytes as they arrive — and
   * because holding one open is what keeps the event page from unloading
   * mid-job.
   */
  attachPort: (port: BackgroundPort) => void;
  /** Follows a group's rename onto the session, when it is the session's group. */
  handleGroupUpdated: (group: GroupEventDetails) => Promise<void>;
  /** Reopens the closed session when its group is restored under the same id. */
  handleGroupCreated: (group: GroupEventDetails) => Promise<void>;
  /**
   * Closes the session when its group is removed, by any path.
   *
   * Not ended: Firefox removes a group the same way whether the user deleted
   * it, saved it, closed its window or closed its last tab, and several of
   * those paths restore it later under the same id.
   */
  handleGroupRemoved: (group: GroupEventDetails) => Promise<void>;
  /** Marks a tab created in the session's group, or brings a restored session tab back. */
  handleTabCreated: (tab: SessionTab) => Promise<void>;
  /** Keeps a tab's session mark in step with the group it moved to. */
  handleTabGroupChanged: (tab: SessionTab) => Promise<void>;
  /**
   * Checks the recorded session against the browser, as on browser start-up,
   * then the session's captured tabs against the tabs that came back. First
   * encrypts any snapshot an earlier version stored in the clear.
   */
  reconcileSession: () => Promise<void>;
  /** Records a page committed in a session tab. */
  handleNavigationCommitted: (navigation: CommittedNavigation) => Promise<void>;
  /** Follows a tab joining or leaving the session's group, or reporting a new title. */
  handleTabUpdated: (tab: CaptureTab, changes: TabChanges) => Promise<void>;
  /** Counts a switch to a session tab. */
  handleTabActivated: (tabId: number) => Promise<void>;
  /**
   * Closes a closed session tab's node. A tab closing with its window is left
   * to start-up reconciliation: session restore may bring it back.
   */
  handleTabRemoved: (tabId: number, removeInfo: { isWindowClosing: boolean }) => Promise<void>;
  /**
   * Validates a message from a session page's observer and answers it.
   *
   * Apart from `handleMessage`: a page may send only its own messages, and the
   * tab it came from is the browser's word, never the message's.
   */
  handleContentMessage: (
    candidate: unknown,
    sender: PageSender,
  ) => Promise<RpcMessage<string, unknown>>;
  /** Follows focus moving to another window, or away from Firefox. */
  handleWindowFocusChanged: () => Promise<void>;
  /** Follows the user going idle or coming back, for reading time. */
  handleIdleStateChanged: (state: IdleState) => Promise<void>;
  /** Starts observing the session's open pages once page access is granted. */
  handlePermissionsAdded: () => Promise<void>;
  /** Releases the worker, if one was ever started. */
  shutdown: () => void;
}
