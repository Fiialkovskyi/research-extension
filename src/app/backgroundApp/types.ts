import type { IDBPDatabase } from "idb";

import type { InferenceWorker } from "@/features/inference";
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
  /**
   * Asks the browser not to evict the database under storage pressure
   * (REQ-STO-009). The browser may decline; a session starts either way.
   */
  persistStorage: () => Promise<boolean>;
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
  /**
   * Ends the session when its group is removed by the user.
   *
   * A removal because the window is closing is ignored: the user did not end
   * the research, and session restore may bring the group back. Reconciling
   * decides later whether it did.
   */
  handleGroupRemoved: (
    group: GroupEventDetails,
    removeInfo: { isWindowClosing: boolean },
  ) => Promise<void>;
  /** Checks the recorded session against the browser, as on browser start-up. */
  reconcileSession: () => Promise<void>;
  /** Releases the worker, if one was ever started. */
  shutdown: () => void;
}
