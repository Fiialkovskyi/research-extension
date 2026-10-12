import * as v from "valibot";

import { chromeResultSchema } from "./schemas";

/**
 * Parses what an asynchronous chrome-context script answered, and returns its
 * value.
 *
 * The script answers a failure as `{ error }` rather than letting it escape,
 * so the test sees Firefox's own message instead of a protocol error.
 *
 * @throws If the answer is not that shape, or the script failed.
 */
export const parseChromeResult = (raw: unknown): unknown => {
  if (typeof raw !== "string") {
    throw new Error(`Expected the chrome script's answer as a JSON string, got ${typeof raw}.`);
  }

  const result = v.parse(chromeResultSchema, JSON.parse(raw));

  if ("error" in result) {
    throw new Error(result.error);
  }

  return result.ok;
};
