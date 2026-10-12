import * as v from "valibot";

/** What an asynchronous chrome-context script hands back: its value, or why it threw. */
export const chromeResultSchema = v.union([
  v.object({ ok: v.unknown() }),
  v.object({ error: v.string() }),
]);
