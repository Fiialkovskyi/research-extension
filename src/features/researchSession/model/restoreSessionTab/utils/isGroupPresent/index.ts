import type { SessionTabApi } from "../../../../types";

/** Whether a tab group with this id exists. Firefox rejects a lookup for one that does not. */
export const isGroupPresent = async (
  getGroup: SessionTabApi["getGroup"],
  groupId: number,
): Promise<boolean> => {
  try {
    await getGroup(groupId);
    return true;
  } catch {
    return false;
  }
};
