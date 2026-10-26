import { describe, expect, it } from "vitest";

import { readPageTypes } from ".";

const pageWith = (...scripts: unknown[]): Document => {
  const document = globalThis.document.implementation.createHTMLDocument("t");

  for (const data of scripts) {
    const script = document.createElement("script");

    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data);
    document.head.append(script);
  }

  return document;
};

describe("readPageTypes", () => {
  it("reads the types of a graph, nested ones included", () => {
    expect(
      readPageTypes(
        pageWith({
          "@type": "Product",
          offers: { "@type": "Offer", price: "1" },
          review: [{ "@type": "Review" }],
        }),
      ),
    ).toEqual(["Product", "Offer", "Review"]);
  });

  it("reads an @graph, a list of types and repeats once", () => {
    expect(
      readPageTypes(
        pageWith({
          "@graph": [{ "@type": ["WebPage", "ItemPage"] }, { "@type": "WebPage" }],
        }),
      ),
    ).toEqual(["WebPage", "ItemPage"]);
  });

  it("keeps at most eight, each cut to 40 characters", () => {
    const types = Array.from({ length: 12 }, (_, index) => ({ "@type": `Type${index}` }));
    const found = readPageTypes(pageWith(types, { "@type": "x".repeat(60) }));

    expect(found).toHaveLength(8);
    expect(readPageTypes(pageWith({ "@type": "x".repeat(60) }))?.[0]).toHaveLength(40);
  });

  it("reads nothing from a page with no JSON-LD or with types that are not text", () => {
    expect(readPageTypes(pageWith())).toBeUndefined();
    expect(readPageTypes(pageWith({ "@type": 5, name: "Product" }))).toBeUndefined();
  });
});
