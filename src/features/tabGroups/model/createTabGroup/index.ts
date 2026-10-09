import * as v from "valibot";

import { tabGroupColorSchema } from "../../schemas";
import type { CreatedTabGroup, TabGroupApi } from "../../types";

export interface CreateTabGroupOptions {
  title: string;
  api: TabGroupApi;
}

/**
 * Opens one empty tab in a new group with the given title, then focuses it.
 *
 * The tab is created hidden and focused last: moving focus closes the popup
 * that asked for this, and the user should never see an ungrouped or untitled
 * tab. If any step after the tab exists fails, the tab is closed — Firefox
 * deletes a group with no tabs, so nothing of the attempt remains.
 *
 * The colour is read back rather than chosen: Firefox assigns it.
 */
export const createTabGroup = async ({
  title,
  api,
}: CreateTabGroupOptions): Promise<CreatedTabGroup> => {
  const tab = await api.createTab({ active: false });
  const tabId = tab.id;

  if (tabId === undefined) {
    throw new Error("The browser created a tab without an id.");
  }

  let created: CreatedTabGroup;

  try {
    const groupId = await api.groupTabs({ tabIds: [tabId] });

    await api.updateGroup(groupId, { title });

    const group = await api.getGroup(groupId);
    const color = v.parse(tabGroupColorSchema, group.color);

    created = { groupId, tabId, title, color };
  } catch (error) {
    await api.removeTab(tabId);
    throw error;
  }

  await api.activateTab(tabId);

  return created;
};
