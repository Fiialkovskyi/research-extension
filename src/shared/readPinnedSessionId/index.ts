import { SESSION_QUERY_PARAMETER } from "@/shared/config";

/**
 * The session a page was opened for (`map.html?session=<id>`), or `undefined`
 * for a page opened without one, which follows the viewed session.
 */
export const readPinnedSessionId = (search: string): string | undefined => {
  const id = new URLSearchParams(search).get(SESSION_QUERY_PARAMETER);

  return id === null || id === "" ? undefined : id;
};
