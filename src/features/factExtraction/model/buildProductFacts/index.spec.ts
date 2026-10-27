import { describe, expect, it } from "vitest";

import { buildProductFacts } from ".";

describe("buildProductFacts", () => {
  it("makes a fact of the product for each thing the page gave, quoting the page's data", () => {
    expect(
      buildProductFacts({
        name: "Pixel 10a",
        brand: "Google",
        price: 24399,
        currency: "UAH",
        availability: "InStock",
        ratingValue: 5,
        ratingCount: 1,
      }),
    ).toEqual([
      {
        subject: "Pixel 10a",
        attribute: "price",
        concept: "price",
        value: "24399",
        unit: "UAH",
        quote: "From the page's data: price 24399 UAH",
      },
      {
        subject: "Pixel 10a",
        attribute: "brand",
        concept: "brand",
        value: "Google",
        quote: "From the page's data: brand Google",
      },
      {
        subject: "Pixel 10a",
        attribute: "availability",
        concept: "availability",
        value: "InStock",
        quote: "From the page's data: availability InStock",
      },
      {
        subject: "Pixel 10a",
        attribute: "rating",
        concept: "rating",
        value: "5",
        quote: "From the page's data: rating 5 from 1 reviews",
      },
      {
        subject: "Pixel 10a",
        attribute: "review count",
        concept: "review count",
        value: "1",
        quote: "From the page's data: review count 1",
      },
    ]);
  });

  it("makes only what the page gave, and a price without a currency has no unit", () => {
    expect(buildProductFacts({ name: "Pixel 10a", price: 10 })).toEqual([
      {
        subject: "Pixel 10a",
        attribute: "price",
        concept: "price",
        value: "10",
        quote: "From the page's data: price 10",
      },
    ]);
    expect(buildProductFacts({ name: "Pixel 10a" })).toEqual([]);
  });

  it("makes none without a product or without its name", () => {
    expect(buildProductFacts(undefined)).toEqual([]);
    expect(buildProductFacts({ price: 10, brand: "Google" })).toEqual([]);
  });
});
