import * as v from "valibot";

export const siteDenylistRequestSchemas = {
  "denylist.read": v.object({}),
  /** Replace the user's sites; each entry is parsed again in the background. */
  "denylist.save": v.object({ sites: v.array(v.string()) }),
} as const;

export const siteDenylistResponseSchemas = {
  "denylist.view": v.object({
    sites: v.array(v.string()),
    /** The entry a save refused because it names no site; the list is then unchanged. */
    invalid: v.optional(v.string()),
  }),
} as const;
