import { describe, expect, it } from "vitest";

import { getModelTreeUrl } from ".";
import { MODEL_HOST_ORIGINS } from "@/shared/huggingFace";

const revision = "751bff37182d3f1213fa05d7196b954e230abad9";

describe("getModelTreeUrl", () => {
  it("addresses the listing of one revision", () => {
    expect(getModelTreeUrl("Xenova/all-MiniLM-L6-v2", revision)).toBe(
      `https://huggingface.co/api/models/Xenova/all-MiniLM-L6-v2/tree/${revision}?recursive=1`,
    );
  });

  it("asks for a recursive listing, so files under a directory are reported", () => {
    expect(new URL(getModelTreeUrl("owner/model", revision)).searchParams.get("recursive")).toBe(
      "1",
    );
  });

  it("stays on a permitted origin", () => {
    expect(MODEL_HOST_ORIGINS).toContain(new URL(getModelTreeUrl("owner/model", revision)).origin);
  });

  it("refuses a repository with a relative component", () => {
    expect(() => getModelTreeUrl("owner/..", revision)).toThrow(/relative/);
  });
});
