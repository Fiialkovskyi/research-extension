import { describe, expect, it } from "vitest";

import { readMetaContent } from ".";

const buildDocument = (head: string): Document => {
  const document = window.document.implementation.createHTMLDocument("");

  document.head.innerHTML = head;

  return document;
};

describe("readMetaContent", () => {
  it("reads a tag by its name or its property", () => {
    const document = buildDocument(
      '<meta name="description" content="Plain"><meta property="og:title" content="Open">',
    );

    expect(readMetaContent(document, "name", "description")).toBe("Plain");
    expect(readMetaContent(document, "property", "og:title")).toBe("Open");
  });

  it("ignores case in the key", () => {
    expect(
      readMetaContent(
        buildDocument('<meta name="Description" content="x">'),
        "name",
        "description",
      ),
    ).toBe("x");
  });

  it("does not take a property for a name", () => {
    expect(
      readMetaContent(buildDocument('<meta property="og:title" content="x">'), "name", "og:title"),
    ).toBeUndefined();
  });

  it("returns nothing when there is no such tag, or it has no content", () => {
    expect(readMetaContent(buildDocument(""), "name", "description")).toBeUndefined();
    expect(
      readMetaContent(buildDocument('<meta name="description">'), "name", "description"),
    ).toBeUndefined();
  });
});
