import { PRODUCT_MAXIMUM_SCRIPT_LENGTH, PRODUCT_MAXIMUM_SCRIPTS } from "../../../../constants";

/**
 * Parses the page's JSON-LD scripts, within the limits on how many are read and
 * how long each may be; a script that is not JSON says nothing and is skipped.
 * Nothing in the markup is run or fetched.
 */
export const readJsonLd = (document: Document): unknown[] => {
  const scripts = Array.from(document.querySelectorAll("script")).filter(
    (script) => script.getAttribute("type")?.toLowerCase() === "application/ld+json",
  );

  return scripts.slice(0, PRODUCT_MAXIMUM_SCRIPTS).flatMap((script) => {
    const text = script.textContent ?? "";

    if (text.length > PRODUCT_MAXIMUM_SCRIPT_LENGTH) {
      return [];
    }

    try {
      return [JSON.parse(text) as unknown];
    } catch {
      return [];
    }
  });
};
