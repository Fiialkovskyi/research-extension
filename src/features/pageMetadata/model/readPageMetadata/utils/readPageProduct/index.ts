import {
  PRODUCT_AVAILABILITY_LIMIT,
  PRODUCT_BRAND_LIMIT,
  PRODUCT_MAXIMUM_SCRIPT_LENGTH,
  PRODUCT_MAXIMUM_SCRIPTS,
  PRODUCT_NAME_LIMIT,
} from "../../../../constants";
import type { PageProduct } from "../../../../types";
import { cleanText } from "../cleanText";
import { findJsonLdProduct } from "../findJsonLdProduct";
import { parsePrice } from "../parsePrice";
import { readMetaContent } from "../readMetaContent";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asText = (value: unknown, limit: number): string | undefined =>
  typeof value === "string" ? cleanText(value, limit) : undefined;

const asCount = (value: unknown): number | undefined => {
  const count = typeof value === "number" ? value : Number(value);

  return Number.isInteger(count) && count >= 0 ? count : undefined;
};

/** The offers of a product as a list: one offer, several, or an aggregate. */
const listOffers = (offers: unknown): Record<string, unknown>[] =>
  (Array.isArray(offers) ? offers : [offers]).filter(isRecord);

/** The lowest price among the offers, with the currency of the offer it came from. */
const readLowestOffer = (
  offers: unknown,
): { price: number; currency: string | undefined; availability: unknown } | undefined => {
  const priced = listOffers(offers).flatMap((offer) => {
    const price = parsePrice(offer["price"] ?? offer["lowPrice"]);

    return price === undefined
      ? []
      : [{ price, currency: offer["priceCurrency"], availability: offer["availability"] }];
  });
  const lowest = priced.toSorted((a, b) => a.price - b.price)[0];

  return lowest === undefined
    ? undefined
    : {
        price: lowest.price,
        currency: typeof lowest.currency === "string" ? lowest.currency : undefined,
        availability: lowest.availability,
      };
};

/** `http://schema.org/InStock` as `InStock`. */
const readAvailability = (value: unknown): string | undefined =>
  asText(
    typeof value === "string" ? (value.split("/").at(-1) ?? "") : undefined,
    PRODUCT_AVAILABILITY_LIMIT,
  );

/** The first JSON-LD product on the page, within the limits on scripts and their size. */
const readJsonLdProduct = (document: Document): Record<string, unknown> | undefined => {
  const scripts = Array.from(document.querySelectorAll("script")).filter(
    (script) => script.getAttribute("type")?.toLowerCase() === "application/ld+json",
  );

  for (const script of scripts.slice(0, PRODUCT_MAXIMUM_SCRIPTS)) {
    const text = script.textContent ?? "";

    if (text.length > PRODUCT_MAXIMUM_SCRIPT_LENGTH) {
      continue;
    }

    try {
      const product = findJsonLdProduct(JSON.parse(text));

      if (product !== undefined) {
        return product;
      }
    } catch {
      // A script that is not JSON says nothing; the next may.
    }
  }

  return undefined;
};

/**
 * Reads the main product a page describes: its JSON-LD `Product` — name, brand,
 * the lowest offer's price and currency and availability, rating and its count
 * — or, with no such product, a price from the Open Graph `product:price` tags.
 * Each text is cut to its limit; a price must be a number above zero and below
 * a billion. Nothing in the markup is run or fetched.
 *
 * Runs in the page and changes nothing in it.
 *
 * @returns The product, or `undefined` when the page describes none.
 */
export const readPageProduct = (document: Document): PageProduct | undefined => {
  const node = readJsonLdProduct(document);
  const product: PageProduct = {};

  if (node !== undefined) {
    const brand = node["brand"];
    const rating = isRecord(node["aggregateRating"]) ? node["aggregateRating"] : undefined;
    const offer = readLowestOffer(node["offers"]);
    const ratingValue = Number(rating?.["ratingValue"]);
    const fields = {
      name: asText(node["name"], PRODUCT_NAME_LIMIT),
      brand: asText(isRecord(brand) ? brand["name"] : brand, PRODUCT_BRAND_LIMIT),
      price: offer?.price,
      currency: offer?.currency?.toUpperCase().match(/^[A-Z]{3}$/u)?.[0],
      availability: readAvailability(offer?.availability),
      ratingValue:
        rating !== undefined &&
        Number.isFinite(ratingValue) &&
        ratingValue >= 0 &&
        ratingValue <= 100
          ? ratingValue
          : undefined,
      ratingCount: asCount(rating?.["reviewCount"] ?? rating?.["ratingCount"]),
    };

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        Object.assign(product, { [key]: value });
      }
    }
  }

  if (product.price === undefined) {
    const price = parsePrice(
      readMetaContent(document, "property", "product:price:amount") ??
        readMetaContent(document, "property", "og:price:amount"),
    );
    const currency = (
      readMetaContent(document, "property", "product:price:currency") ??
      readMetaContent(document, "property", "og:price:currency")
    )
      ?.trim()
      .toUpperCase();

    if (price !== undefined) {
      product.price = price;

      if (currency !== undefined && /^[A-Z]{3}$/u.test(currency)) {
        product.currency = currency;
      }
    }
  }

  return Object.keys(product).length === 0 ? undefined : product;
};
