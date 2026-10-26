import { describe, expect, it } from "vitest";

import { readPageProduct } from ".";

const buildDocument = (head: string, body = ""): Document => {
  const document = window.document.implementation.createHTMLDocument("");

  document.documentElement.innerHTML = `<head>${head}</head><body>${body}</body>`;

  return document;
};

const ldJson = (value: unknown): string =>
  `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

const SHOP_PRODUCT = {
  "@context": "http://schema.org",
  "@type": "Product",
  name: "Google Pixel 10a 8/256GB (Lavender)",
  brand: { "@type": "Brand", name: "Google" },
  sku: "-",
  aggregateRating: { "@type": "AggregateRating", ratingValue: "5", reviewCount: "1" },
  offers: {
    "@type": "Offer",
    availability: "http://schema.org/InStock",
    price: "24399",
    priceCurrency: "UAH",
  },
};

describe("readPageProduct", () => {
  it("reads a shop's product: name, brand, price, currency, availability and rating", () => {
    expect(readPageProduct(buildDocument(ldJson(SHOP_PRODUCT)))).toEqual({
      name: "Google Pixel 10a 8/256GB (Lavender)",
      brand: "Google",
      price: 24399,
      currency: "UAH",
      availability: "InStock",
      ratingValue: 5,
      ratingCount: 1,
    });
  });

  it("finds the product in a graph beside an organisation and a breadcrumb, in the body too", () => {
    const product = readPageProduct(
      buildDocument(
        "",
        ldJson({
          "@graph": [
            { "@type": "Organization", name: "Shop" },
            { "@type": "BreadcrumbList" },
            SHOP_PRODUCT,
          ],
        }),
      ),
    );

    expect(product).toMatchObject({ name: "Google Pixel 10a 8/256GB (Lavender)", price: 24399 });
  });

  it("takes the first of several scripts that holds a product, and skips one that does not parse", () => {
    const head = `<script type="application/ld+json">{ not json</script>${ldJson({ "@type": "Organization" })}${ldJson(SHOP_PRODUCT)}`;

    expect(readPageProduct(buildDocument(head))).toMatchObject({ price: 24399 });
  });

  it("takes the lowest price of an array of offers, with its currency", () => {
    const product = readPageProduct(
      buildDocument(
        ldJson({
          "@type": "Product",
          name: "Pixel",
          offers: [
            { price: 30000, priceCurrency: "UAH" },
            { price: 700, priceCurrency: "USD" },
          ],
        }),
      ),
    );

    expect(product).toMatchObject({ price: 700, currency: "USD" });
  });

  it("reads an aggregate offer's low price", () => {
    expect(
      readPageProduct(
        buildDocument(
          ldJson({
            "@type": "Product",
            name: "Pixel",
            offers: { "@type": "AggregateOffer", lowPrice: "199.90", priceCurrency: "EUR" },
          }),
        ),
      ),
    ).toMatchObject({ price: 199.9, currency: "EUR" });
  });

  it("keeps the name and brand when the price is not a price", () => {
    const product = readPageProduct(
      buildDocument(
        ldJson({
          "@type": "Product",
          name: "Pixel",
          brand: "Google",
          offers: { price: "call us" },
        }),
      ),
    );

    expect(product).toEqual({ name: "Pixel", brand: "Google" });
  });

  it("reads a brand written as plain text", () => {
    expect(
      readPageProduct(buildDocument(ldJson({ "@type": "Product", name: "P", brand: "Google" }))),
    ).toMatchObject({ brand: "Google" });
  });

  it("leaves out a currency that is not a code and a rating that is out of range", () => {
    const product = readPageProduct(
      buildDocument(
        ldJson({
          "@type": "Product",
          name: "P",
          offers: { price: 10, priceCurrency: "hryvnia" },
          aggregateRating: { ratingValue: "500", reviewCount: "-3" },
        }),
      ),
    );

    expect(product).toEqual({ name: "P", price: 10 });
  });

  it("cuts a long name to its limit", () => {
    const product = readPageProduct(
      buildDocument(ldJson({ "@type": "Product", name: "x".repeat(900) })),
    );

    expect(product?.name).toHaveLength(300);
  });

  it("skips a script larger than the limit and reads no more than eight scripts", () => {
    const big = `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "Big", pad: "x".repeat(200_001) })}</script>`;
    const filler = Array.from({ length: 8 }, () => ldJson({ "@type": "Organization" })).join("");

    expect(readPageProduct(buildDocument(big))).toBeUndefined();
    expect(readPageProduct(buildDocument(filler + ldJson(SHOP_PRODUCT)))).toBeUndefined();
  });

  it("reads a price from the Open Graph product tags when there is no product markup", () => {
    expect(
      readPageProduct(
        buildDocument(`
          <meta property="product:price:amount" content="24 399">
          <meta property="product:price:currency" content="uah">
        `),
      ),
    ).toEqual({ price: 24399, currency: "UAH" });
  });

  it("prefers the markup's price over the tags", () => {
    expect(
      readPageProduct(
        buildDocument(`${ldJson(SHOP_PRODUCT)}<meta property="product:price:amount" content="1">`),
      ),
    ).toMatchObject({ price: 24399 });
  });

  it("gives nothing for a page with no product, or markup of other kinds only", () => {
    expect(readPageProduct(buildDocument("<title>Blog</title>"))).toBeUndefined();
    expect(
      readPageProduct(buildDocument(ldJson({ "@type": "Article", name: "Essay" }))),
    ).toBeUndefined();
  });

  it("does not run or follow anything in the markup", () => {
    const product = readPageProduct(
      buildDocument(
        ldJson({
          "@type": "Product",
          name: "P",
          url: "https://evil.example/",
          image: "https://evil.example/x.png",
        }),
      ),
    );

    expect(product).toEqual({ name: "P" });
  });
});
