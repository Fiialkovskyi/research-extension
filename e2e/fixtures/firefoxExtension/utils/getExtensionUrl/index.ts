import { PINNED_EXTENSION_UUID } from "../../constants";

/**
 * Addresses a document inside the installed extension.
 *
 * Only knowable because the test profile pins the add-on's UUID; with
 * Firefox's default random UUID this address differs on every run. Callers
 * pass the path they want — `getExtensionUrl(POPUP_PATH)` for the popup — rather
 * than going through a wrapper per document.
 */
export const getExtensionUrl = (path: string, uuid: string = PINNED_EXTENSION_UUID): string => {
  return `moz-extension://${uuid}/${path.replace(/^\/+/, "")}`;
};
