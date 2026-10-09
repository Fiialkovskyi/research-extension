import { describe, expect, it } from "vitest";

import { getToolbarWidgetId } from "./index";

describe("getToolbarWidgetId", () => {
  it("derives the id Firefox gives this project's toolbar button", () => {
    expect(getToolbarWidgetId("research-graph@example.org")).toBe(
      "research-graph_example_org-browser-action",
    );
  });

  it("replaces the characters an add-on id may carry but a DOM id may not", () => {
    expect(getToolbarWidgetId("a@b.c+d:e")).toBe("a_b_c_d_e-browser-action");
  });

  it("lowercases, because Firefox does", () => {
    expect(getToolbarWidgetId("Research-Graph@Example.ORG")).toBe(
      "research-graph_example_org-browser-action",
    );
  });

  it("keeps hyphens, underscores and digits, which are already legal", () => {
    expect(getToolbarWidgetId("my_add-on2")).toBe("my_add-on2-browser-action");
  });

  it("handles a UUID-style add-on id in braces", () => {
    expect(getToolbarWidgetId("{d4d4f1d0-0000-4000-8000-abcdefabcdef}")).toBe(
      "_d4d4f1d0-0000-4000-8000-abcdefabcdef_-browser-action",
    );
  });
});
