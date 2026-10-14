import * as v from "valibot";

/** One child process: its type, and its memory in bytes. */
export const processMemorySchema = v.array(v.object({ type: v.string(), memory: v.number() }));
