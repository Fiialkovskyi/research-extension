import { describe, expect, it } from "vitest";

import { findJsonLdProduct } from ".";

const PRODUCT = { "@type": "Product", name: "Pixel" };

describe("findJsonLdProduct", () => {
  it("finds a product that is the whole value", () => {
    expect(findJsonLdProduct(PRODUCT)).toBe(PRODUCT);
  });

  it("finds it among the items of an array", () => {
    expect(findJsonLdProduct([{ "@type": "Organization" }, PRODUCT])).toBe(PRODUCT);
  });

  it("finds it in a graph", () => {
    expect(findJsonLdProduct({ "@graph": [{ "@type": "BreadcrumbList" }, PRODUCT] })).toBe(PRODUCT);
  });

  it("takes a type that lists Product among others", () => {
    const node = { "@type": ["Thing", "Product"], name: "x" };

    expect(findJsonLdProduct(node)).toBe(node);
  });

  it("takes the first of two products", () => {
    const second = { "@type": "Product", name: "Second" };

    expect(findJsonLdProduct([PRODUCT, second])).toBe(PRODUCT);
  });

  it("finds nothing in markup that has no product, or is not markup", () => {
    expect(findJsonLdProduct({ "@type": "Organization" })).toBeUndefined();
    expect(findJsonLdProduct("Product")).toBeUndefined();
    expect(findJsonLdProduct(null)).toBeUndefined();
    expect(findJsonLdProduct(42)).toBeUndefined();
  });

  it("stops looking a few levels down", () => {
    let nested: unknown = PRODUCT;

    for (let level = 0; level < 20; level += 1) {
      nested = { "@graph": [nested] };
    }

    expect(findJsonLdProduct(nested)).toBeUndefined();
  });
});
