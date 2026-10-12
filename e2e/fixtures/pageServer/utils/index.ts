/**
 * Serves the pages the capture suite browses, offline, on the loopback
 * interface. Started by the launcher in `onPrepare`; specs read its origin
 * from the environment variable named in `../constants.ts`.
 *
 * This file is the public surface and holds no logic.
 */

export { resolvePagePath } from "./resolvePagePath";
export { type PageServer, startPageServer } from "./startPageServer";
