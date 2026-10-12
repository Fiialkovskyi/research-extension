import type { DBSchema } from "idb";

import type { InferenceDevice, ModelManifest } from "../modelManifest";
import type {
  CLUSTERING_STORE,
  EDGE_STORE,
  INFERENCE_RUN_STORE,
  JOB_STORE,
  KEY_STORE,
  MODEL_FILE_STORE,
  MODEL_STORE,
  NODE_STORE,
  SESSION_STORE,
  SNAPSHOT_STORE,
} from "./constants";

/** Outcome of the family conformance suite, which gates activation. */
export type ConformanceStatus = "pending" | "passed" | "failed";

/** How an inference run ended. */
export type InferenceOutcome = "ok" | "failed" | "cancelled";

export interface StoredModel {
  /** Repository and pinned revision, so two revisions coexist rather than collide. */
  ref: string;
  manifest: ModelManifest;
  /**
   * Whether features may obtain this model. Deliberately not an index:
   * IndexedDB cannot key on a boolean, and a profile holds a handful of models,
   * so filtering in memory costs nothing an index would save.
   */
  active: boolean;
  conformance: ConformanceStatus;
  /** Why conformance failed, shown to the user instead of a bare refusal. */
  conformanceReason?: string;
  diskBytes: number;
  installedAt: number;
}

export interface StoredModelFile {
  ref: string;
  path: string;
  /** Verified contents. Written only after its digest matched the manifest. */
  contents: ArrayBuffer;
}

/**
 * One inference run, recorded for lineage and for honest throughput claims.
 *
 * Content-free by construction: there is no field for the text that was
 * embedded or generated, so the log cannot accumulate page content.
 */
export interface StoredInferenceRun {
  runId: string;
  modelRef: string;
  device: InferenceDevice;
  durationMs: number;
  outcome: InferenceOutcome;
  /** How many texts or chunks the run processed. A count, never the content. */
  itemCount: number;
  startedAt: number;
}

/**
 * Where a session is in its life.
 *
 * - `active`: its group is open and the session is being recorded.
 * - `closed`: its group was removed, and may come back. Firefox removes a group
 *   the same way whether the user deleted it, saved it or closed its last tab,
 *   and several of those paths restore it under the same id, so a removal
 *   suspends the session rather than ending it.
 * - `saved`: ended. Kept, not deleted, so its research stays available.
 *
 * Until after the MVP at most one session is `active` or `closed`.
 */
export type SessionStatus = "active" | "closed" | "saved";

/**
 * One research session: a Firefox tab group the extension follows.
 *
 * Until after the MVP at most one record is `active` at a time; the transaction
 * that creates a session checks that, not the surface that asked.
 */
export interface StoredSession {
  /** A UUID, so a session keeps its identity if its group is ever replaced. */
  id: string;
  /** Mirrors the group's title, which the user may rename in the tab strip. */
  title: string;
  /**
   * The tab group's id. Stable across a browser restart with session restore,
   * which is what lets a woken background find the session's group again. A
   * window id is deliberately not kept: it is not stable across restarts.
   */
  groupId: number;
  /**
   * Groups the session followed before `groupId`, oldest first. A session tab
   * restored after its group was gone for good gets a new group, under a new
   * id; if the old group is restored later after all, its tabs are recognised
   * by this list and moved into the session's current group.
   */
  formerGroupIds: number[];
  status: SessionStatus;
  /**
   * The visit the user is on now, kept here rather than in memory so an
   * unloaded event page loses no reading time. Absent until the first focus.
   */
  focus?: StoredFocusVisit;
  /**
   * Moves of focus from one node to another in the last few minutes, oldest
   * first, from which co-attention is counted. Absent until the first move.
   */
  recentSwitches?: StoredFocusSwitch[];
  createdAt: number;
  updatedAt: number;
}

/** Focus moving from one node to another, and when. */
export interface StoredFocusSwitch {
  from: string;
  to: string;
  at: number;
}

/**
 * One visit to a node: from its tab being selected until another node gets
 * focus. Losing window focus or going idle pauses a visit rather than ending it.
 */
export interface StoredFocusVisit {
  nodeId: string;
  /** When the running interval of active time began; `null` while paused. */
  since: number | null;
  /** Active time this visit has added so far. */
  visitDwellMs: number;
  /** The node already had active time when this visit began. */
  isRevisit: boolean;
  /** This visit has already been counted as a revisit. */
  isRevisitCounted: boolean;
}

/** A search results page, or any other page. */
export type NodeKind = "serp" | "page";

/** Whether the node's tab is still open. Never focused is `focusCount === 0`. */
export type NodeTabState = "open" | "closed";

/** How two nodes are related (target spec §4, in camelCase). */
export type EdgeKind = "opener" | "sameTab" | "refinement" | "coAttention" | "return" | "user";

/**
 * What was observed about a page, as raw counts and extremes.
 *
 * The engagement state (unread, skimmed, deep read, dead end) is not here: it
 * is derived from these by versioned rules, and storing it would need a rewrite
 * every time the rules change.
 */
export interface StoredNodeSignals {
  /** Focused, visible and not idle, in milliseconds. */
  activeDwellMs: number;
  /** Deepest scroll reached, from 0 to 1. */
  maxScroll: number;
  /** Copy events seen. Only their number: the copied text is never read. */
  copyEvents: number;
  focusCount: number;
  revisitCount: number;
  /** First visits, reached from a search, that went straight back to a search. */
  quickReturnCount: number;
}

/** One page recorded in a session's graph. */
export interface StoredNode {
  /** A UUID: the same URL visited twice is two nodes. */
  id: string;
  sessionId: string;
  /**
   * The tab that showed the page. Not in the target spec's `GraphNode`: a woken
   * background needs it to find the node each tab shows. Tab ids are reused
   * across restarts, so it identifies a node only together with `tabState`.
   */
  tabId: number;
  kind: NodeKind;
  url: string;
  domain: string;
  title: string;
  /** The search query, on SERP nodes only. */
  query?: string;
  /** The previous node in the same tab, or `null` for the tab's first. */
  parentNodeId: string | null;
  /** The node whose tab opened this one, or `null`. */
  openerNodeId: string | null;
  /** The browser's transition type for the navigation, such as `link` or `typed`. */
  transitionType: string;
  signals: StoredNodeSignals;
  /** A closed node keeps its history; it is never deleted for closing. */
  tabState: NodeTabState;
  createdAt: number;
  lastFocusedAt?: number;
  /** The page's readable text, once captured when it was first deep read. */
  snapshotId?: string;
  /** SHA-256 of that text, so equal pages are recognised without reading it. */
  contentHash?: string;
}

/** One relation between two nodes of a session. */
export interface StoredEdge {
  /**
   * `${from}|${to}|${kind}`: the relation is its own key, so recording it again
   * finds the first record instead of adding a second.
   */
  id: string;
  sessionId: string;
  kind: EdgeKind;
  from: string;
  to: string;
  weight: number;
  createdAt: number;
}

/** Where a job is in its life. `failed` is final until the work is asked for again. */
export type JobStatus = "queued" | "running" | "done" | "failed";

/**
 * One unit of background work, durable across event-page unloads.
 *
 * Its id is derived from what it does — type, inputs, producer version — so the
 * same work asked for twice is one job, not two.
 */
export interface StoredJob {
  /** SHA-256 of the type, the sorted input hashes and the producer version. */
  id: string;
  type: string;
  /** The session the work is for, so deleting a session can find its jobs. */
  sessionId?: string;
  /** Content hashes of what the job reads. Part of its identity. */
  inputHashes: string[];
  /** Version of the code or model that produces the output. Part of its identity. */
  producerVersion: string;
  status: JobStatus;
  /** Higher runs first. */
  priority: number;
  /** Failed attempts so far. An interrupted attempt is not counted. */
  attempts: number;
  /** The job is not handed out before this time; a retry's backoff sets it. */
  nextAttemptAt: number;
  /**
   * The job type's own progress record, opaque to the queue. The job validates
   * it when it reads it back; kept across retries so a retry resumes.
   */
  checkpoint?: unknown;
  /** Why the last attempt failed, shown when the job has failed for good. */
  failureReason?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * The readable text of a page, captured once when its node was first deep read.
 *
 * The text is stored only encrypted with the data key (REQ-SEC-005), after
 * compression. What stays in the clear — hash, length, flags, times — says
 * whether two pages hold the same text, never what it is.
 */
export interface StoredSnapshot {
  /** A UUID. */
  id: string;
  sessionId: string;
  nodeId: string;
  /** Hex SHA-256 of the stored text, after any truncation. */
  contentHash: string;
  /** Length of the stored text in UTF-8 bytes, before compression. */
  byteLength: number;
  /** The page's text was longer than the limit and was cut. */
  truncated: boolean;
  /** Which extractor produced the text, so a later extractor can tell. */
  extractorVersion: string;
  capturedAt: number;
  /** The data key that encrypted the text. */
  keyId: string;
  /** The cipher and key size, so a later change of either can tell old records. */
  cipher: "aes-gcm-256";
  /** The IV the text was encrypted under; random and unique per snapshot. */
  iv: Uint8Array;
  /** The text, gzip-compressed, then encrypted. */
  encryptedText: ArrayBuffer;
}

/**
 * The extension's data key. Non-extractable: no script, the extension's own
 * included, can read its bytes; it can only be used. Kept by structured clone.
 */
export interface StoredDataKey {
  id: string;
  key: CryptoKey;
  algorithm: "AES-GCM";
  createdAt: number;
}

/** One group of a session's pages, as clustering found it. */
export interface StoredCluster {
  /** Kept across recomputes while the cluster keeps most of its pages. */
  id: string;
  /** The query of its earliest search, or the title of its earliest page. */
  label: string;
  memberIds: string[];
}

/**
 * A session's latest clustering, replaced whole on every recompute so a reader
 * never sees half of one. Derived: it can always be computed again.
 */
export interface StoredClustering {
  sessionId: string;
  /** The algorithm that produced it, such as `louvain@1` (REQ-CLU-006). */
  algorithmVersion: string;
  /** The edge weights and options it used, such as `cluster_config@1`. */
  configVersion: string;
  computedAt: number;
  clusters: StoredCluster[];
}

export interface ResearchDatabaseSchema extends DBSchema {
  [MODEL_STORE]: {
    key: string;
    value: StoredModel;
    indexes: { family: string };
  };
  [MODEL_FILE_STORE]: {
    key: [string, string];
    value: StoredModelFile;
    indexes: { ref: string };
  };
  [INFERENCE_RUN_STORE]: {
    key: string;
    value: StoredInferenceRun;
    indexes: { modelRef: string; startedAt: number };
  };
  [SESSION_STORE]: {
    key: string;
    value: StoredSession;
    indexes: { status: SessionStatus };
  };
  [NODE_STORE]: {
    key: string;
    value: StoredNode;
    indexes: { sessionId: string; sessionTab: [string, number] };
  };
  [EDGE_STORE]: {
    key: string;
    value: StoredEdge;
    indexes: { sessionId: string };
  };
  [JOB_STORE]: {
    key: string;
    value: StoredJob;
    indexes: { statusPriority: [JobStatus, number] };
  };
  [SNAPSHOT_STORE]: {
    key: string;
    value: StoredSnapshot;
  };
  [KEY_STORE]: {
    key: string;
    value: StoredDataKey;
  };
  [CLUSTERING_STORE]: {
    key: string;
    value: StoredClustering;
  };
}
