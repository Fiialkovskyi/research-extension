import * as v from "valibot";

import { DATA_TOPICS } from "./constants";

export const liveDataRequestSchemas = {
  /**
   * Sent over a port: the background tells the port which kinds of data changed,
   * until it disconnects. It answers with no topics; the page reads for itself.
   */
  "data.subscribe": v.object({}),
} as const;

export const liveDataResponseSchemas = {
  /** Says what changed, never the data: the page reads it again with its own request. */
  "data.changed": v.object({ topics: v.array(v.picklist(DATA_TOPICS)) }),
} as const;
