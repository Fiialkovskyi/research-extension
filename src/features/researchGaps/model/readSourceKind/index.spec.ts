import { describe, expect, it } from "vitest";

import { readSourceKind } from ".";

describe("readSourceKind", () => {
  it.each([
    [{ schemaTypes: ["Product", "Offer"] }, "shop"],
    [{ schemaTypes: ["Product", "Review"] }, "review"],
    [{ schemaTypes: ["DiscussionForumPosting"] }, "forum"],
    [{ schemaTypes: ["QAPage"] }, "forum"],
    [{ schemaTypes: ["VideoObject"] }, "video"],
    [{ type: "video.other" }, "video"],
    [{ type: "product" }, "shop"],
    [{ type: "og:product" }, "shop"],
    [{ schemaTypes: ["offer"] }, "shop"],
  ] as const)("reads %j as %s", (declared, kind) => {
    expect(readSourceKind(declared)).toBe(kind);
  });

  it("reads a page that declares a forum post and an offer as a forum", () => {
    expect(readSourceKind({ schemaTypes: ["Offer", "DiscussionForumPosting"] })).toBe("forum");
  });

  it("reads a shop with reviews as a shop", () => {
    expect(readSourceKind({ schemaTypes: ["Product", "Offer", "Review"] })).toBe("shop");
  });

  it("reads nothing when the page declares nothing that says, whatever it is called", () => {
    expect(readSourceKind({})).toBeUndefined();
    expect(readSourceKind({ schemaTypes: ["WebPage"], type: "article" })).toBeUndefined();
    expect(readSourceKind({ type: "videography" })).toBeUndefined();
  });
});
