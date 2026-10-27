import type { PageProduct } from "@/features/pageMetadata";

import { PRODUCT_DATA_QUOTE_PREFIX } from "../../constants";
import type { ExtractedFact } from "../../types";

/**
 * Makes facts of a page's product from the data the page gave about it — price
 * with its currency, brand, availability, rating and how many rated it — with the product's name
 * as their subject. Each quote says it is from the page's data, so a reader
 * can tell it from a sentence the model read.
 *
 * @returns The facts, in a fixed order; none without a product name or when
 *   the page gave nothing else.
 */
export const buildProductFacts = (product: PageProduct | undefined): ExtractedFact[] => {
  const subject = product?.name;

  if (product === undefined || subject === undefined) {
    return [];
  }

  const facts: ExtractedFact[] = [];
  const add = (attribute: string, value: string, unit: string | undefined, said: string): void => {
    facts.push({
      subject,
      attribute,
      // The page's own data is named by the extension, in English, so the concept is the attribute.
      concept: attribute,
      value,
      ...(unit === undefined ? {} : { unit }),
      quote: `${PRODUCT_DATA_QUOTE_PREFIX}${said}`,
    });
  };

  if (product.price !== undefined) {
    add(
      "price",
      String(product.price),
      product.currency,
      `price ${[product.price, product.currency].filter((part) => part !== undefined).join(" ")}`,
    );
  }

  if (product.brand !== undefined) {
    add("brand", product.brand, undefined, `brand ${product.brand}`);
  }

  if (product.availability !== undefined) {
    add("availability", product.availability, undefined, `availability ${product.availability}`);
  }

  if (product.ratingValue !== undefined) {
    add(
      "rating",
      String(product.ratingValue),
      undefined,
      product.ratingCount === undefined
        ? `rating ${product.ratingValue}`
        : `rating ${product.ratingValue} from ${product.ratingCount} reviews`,
    );
  }

  if (product.ratingCount !== undefined) {
    // Not "rating count": by its embedding that concept shares a column with "rating".
    add(
      "review count",
      String(product.ratingCount),
      undefined,
      `review count ${product.ratingCount}`,
    );
  }

  return facts;
};
