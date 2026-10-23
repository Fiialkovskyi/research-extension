import type { DATA_TOPICS } from "./constants";

/** One kind of data a page can be told has changed. */
export type DataTopic = (typeof DATA_TOPICS)[number];
