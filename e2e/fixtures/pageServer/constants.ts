import { fileURLToPath } from "node:url";

/** The pages the capture suite browses, served offline. */
export const PAGES_DIRECTORY = fileURLToPath(new URL("./pages/", import.meta.url));

/**
 * Environment variable carrying the server's origin from the launcher, which
 * starts the server, to the workers, which inherit the launcher's environment.
 */
export const PAGE_ORIGIN_VARIABLE = "E2E_PAGE_ORIGIN";
