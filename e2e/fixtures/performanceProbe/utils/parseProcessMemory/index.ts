import * as v from "valibot";

import { processMemorySchema } from "./schemas";

/**
 * Reads the extension process's memory out of what the script returned: the
 * sum over processes of type `extension`, in bytes.
 *
 * @throws If it is not a JSON string listing processes, or none is an extension process.
 */
export const parseProcessMemory = (raw: unknown): number => {
  if (typeof raw !== "string") {
    throw new Error(`Expected the process list as a JSON string, got ${typeof raw}.`);
  }

  const extensions = v
    .parse(processMemorySchema, JSON.parse(raw))
    .filter(({ type }) => type === "extension");

  if (extensions.length === 0) {
    throw new Error("No extension process is running.");
  }

  return extensions.reduce((sum, { memory }) => sum + memory, 0);
};
