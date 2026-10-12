import type * as v from "valibot";

import type { TAB_GROUP_COLORS } from "./constants";
import type { tabGroupRequestSchemas, tabGroupResponseSchemas } from "./schemas";

export type TabGroupRequestType = keyof typeof tabGroupRequestSchemas;
export type TabGroupResponseType = keyof typeof tabGroupResponseSchemas;
export type TabGroupColor = (typeof TAB_GROUP_COLORS)[number];
export type CreatedTabGroup = v.InferOutput<(typeof tabGroupResponseSchemas)["tabGroup.created"]>;

/**
 * The part of the browser's tab APIs that starting a session uses.
 *
 * Declared structurally so the sequence and its rollback are exercised without
 * an extension runtime; the background entrypoint passes the real methods.
 */
export interface TabGroupApi {
  createTab: (properties: { active: boolean }) => Promise<{ id?: number }>;
  groupTabs: (options: { tabIds: [number, ...number[]] }) => Promise<number>;
  updateGroup: (groupId: number, properties: { title: string }) => Promise<unknown>;
  getGroup: (groupId: number) => Promise<{ color: string; title?: string }>;
  activateTab: (tabId: number) => Promise<unknown>;
  removeTab: (tabId: number) => Promise<void>;
}
