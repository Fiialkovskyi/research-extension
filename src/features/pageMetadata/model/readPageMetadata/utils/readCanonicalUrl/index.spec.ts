import { describe, expect, it } from "vitest";

import { readCanonicalUrl } from ".";

const buildDocument = (head: string): Document => {
  const document = window.document.implementation.createHTMLDocument("");

  document.head.innerHTML = head;

  return document;
};

describe("readCanonicalUrl", () => {
  it("reads an absolute canonical address", () => {
    expect(
      readCanonicalUrl(buildDocument('<link rel="canonical" href="https://example.org/a">')),
    ).toBe("https://example.org/a");
  });

  it("drops an address that is not http or https", () => {
    expect(
      readCanonicalUrl(buildDocument('<link rel="canonical" href="javascript:alert(1)">')),
    ).toBeUndefined();
  });

  it("drops one past the length limit", () => {
    expect(
      readCanonicalUrl(
        buildDocument(`<link rel="canonical" href="https://example.org/${"a".repeat(2100)}">`),
      ),
    ).toBeUndefined();
  });

  it("returns nothing without a canonical link or with an empty one", () => {
    expect(readCanonicalUrl(buildDocument(""))).toBeUndefined();
    expect(readCanonicalUrl(buildDocument('<link rel="canonical" href=" ">'))).toBeUndefined();
  });
});
