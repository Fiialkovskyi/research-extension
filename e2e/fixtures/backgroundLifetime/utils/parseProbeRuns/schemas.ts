import * as v from "valibot";

/** The probe runs the options page's Developer card lists. */
export const probeRunsSchema = v.array(
  v.object({
    runId: v.string(),
    strategy: v.string(),
    state: v.picklist(["running", "completed", "resumed", "stopped"]),
    text: v.string(),
  }),
);
