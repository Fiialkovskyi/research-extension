import * as v from "valibot";

export const pageNoticeRequestSchemas = {
  /** Whether a page that was just recorded shows a notice. */
  "pageNotice.read": v.object({}),
  /** Turns the notice on or off for every later page. */
  "pageNotice.set": v.object({ isEnabled: v.boolean() }),
} as const;

export const pageNoticeResponseSchemas = {
  "pageNotice.status": v.object({ isEnabled: v.boolean() }),
} as const;
