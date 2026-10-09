import { describe, expect, it } from "vitest";

import { getModelRevisionUrl } from ".";
import { HUGGING_FACE_ORIGIN, MODEL_HOST_ORIGINS } from "@/shared/huggingFace";

describe("getModelRevisionUrl", () => {
  it("addresses the hub's revision endpoint for an owner and name", () => {
    expect(getModelRevisionUrl("Xenova/all-MiniLM-L6-v2", "main")).toBe(
      `${HUGGING_FACE_ORIGIN}/api/models/Xenova/all-MiniLM-L6-v2/revision/main`,
    );
  });

  it("keeps the slashes in a multi-segment reference, which the hub needs", () => {
    expect(getModelRevisionUrl("owner/model", "refs/pr/1")).toBe(
      `${HUGGING_FACE_ORIGIN}/api/models/owner/model/revision/refs/pr/1`,
    );
  });

  it("keeps a reference containing dots that are not a whole segment", () => {
    expect(new URL(getModelRevisionUrl("owner/model", "v1.2.3")).pathname).toBe(
      "/api/models/owner/model/revision/v1.2.3",
    );
  });

  it("stays on a permitted origin", () => {
    const { origin } = new URL(getModelRevisionUrl("owner/model", "main"));

    expect(MODEL_HOST_ORIGINS).toContain(origin);
  });

  it("refuses a reference that would address another endpoint", () => {
    // The refusal itself is buildHubUrl's; this asserts the revision endpoint
    // actually routes through it rather than concatenating by hand.
    expect(() => getModelRevisionUrl("owner/model", "../../etc")).toThrow(/relative/);
  });
});
