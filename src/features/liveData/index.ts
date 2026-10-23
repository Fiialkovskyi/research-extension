/**
 * Live pages: the background tells every open page which kinds of data changed,
 * and the page reads again. A notification carries no data, so what a page may
 * read stays decided by the request it already has.
 */

// `ui/` is deliberately absent from this barrel: the background imports
// feature barrels and has no use for React. Surfaces import the hook by path.

export { DATA_TOPICS } from "./constants";
export { liveDataRequestSchemas, liveDataResponseSchemas } from "./schemas";
export type { DataTopic } from "./types";
export { watchDataChanges } from "./model/watchDataChanges";
export type { WatchablePort, WatchDataChangesOptions } from "./model/watchDataChanges";
