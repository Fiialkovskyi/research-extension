import type * as v from "valibot";

import type {
  researchSessionRequestSchemas,
  researchSessionResponseSchemas,
  sessionSummarySchema,
} from "./schemas";

export type SessionSummary = v.InferOutput<typeof sessionSummarySchema>;
export type ResearchSessionRequestType = keyof typeof researchSessionRequestSchemas;
export type ResearchSessionResponseType = keyof typeof researchSessionResponseSchemas;

/**
 * The browser calls that follow a session's tabs: Firefox's per-tab session
 * values, which survive a tab being closed and restored, and the grouping calls
 * that put a restored tab back.
 *
 * Declared structurally so the logic is exercised without an extension
 * runtime; the background entrypoint passes the real methods.
 */
export interface SessionTabApi {
  getTabValue: (tabId: number, key: string) => Promise<unknown>;
  setTabValue: (tabId: number, key: string, value: string) => Promise<void>;
  removeTabValue: (tabId: number, key: string) => Promise<void>;
  /** Adds the tabs to `groupId`, or to a new group when it is absent; answers the group's id. */
  groupTabs: (options: { tabIds: [number, ...number[]]; groupId?: number }) => Promise<number>;
  updateGroup: (groupId: number, properties: { title: string }) => Promise<unknown>;
  /** Rejects when no such group exists. */
  getGroup: (groupId: number) => Promise<unknown>;
}

/** The part of a tab a session follows. `groupId` is `NO_TAB_GROUP` outside any group. */
export interface SessionTab {
  id: number;
  groupId: number;
}
