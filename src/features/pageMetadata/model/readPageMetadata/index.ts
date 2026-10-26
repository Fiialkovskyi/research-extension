import {
  METADATA_AUTHOR_LIMIT,
  METADATA_DESCRIPTION_LIMIT,
  METADATA_PUBLISHED_AT_LIMIT,
  METADATA_SITE_NAME_LIMIT,
  METADATA_TITLE_LIMIT,
  METADATA_TYPE_LIMIT,
} from "../../constants";
import type { PageMetadata } from "../../types";
import { cleanText } from "./utils/cleanText";
import { readCanonicalUrl } from "./utils/readCanonicalUrl";
import { readMetaContent } from "./utils/readMetaContent";
import { readPageProduct } from "./utils/readPageProduct";
import { readPageTypes } from "./utils/readPageTypes";

/**
 * Reads what a page says about itself in its head: its title, description,
 * site name, type, author, publication time and canonical address, each
 * cleaned and cut to its limit, the schema.org types its JSON-LD declares, and the main product it describes (name, brand,
 * price, availability, rating). `og:` tags come before the plain ones, and no
 * other tag is read — `og:image` least of all.
 *
 * Runs in the page and changes nothing in it.
 *
 * @returns The metadata, or `undefined` when the page says nothing of itself.
 */
export const readPageMetadata = (document: Document): PageMetadata | undefined => {
  const metadata: PageMetadata = {};
  const fields = {
    title: cleanText(
      readMetaContent(document, "property", "og:title") ?? document.title,
      METADATA_TITLE_LIMIT,
    ),
    description: cleanText(
      readMetaContent(document, "property", "og:description") ??
        readMetaContent(document, "name", "description"),
      METADATA_DESCRIPTION_LIMIT,
    ),
    siteName: cleanText(
      readMetaContent(document, "property", "og:site_name"),
      METADATA_SITE_NAME_LIMIT,
    ),
    type: cleanText(readMetaContent(document, "property", "og:type"), METADATA_TYPE_LIMIT),
    author: cleanText(
      readMetaContent(document, "name", "author") ??
        readMetaContent(document, "property", "article:author"),
      METADATA_AUTHOR_LIMIT,
    ),
    publishedAt: cleanText(
      readMetaContent(document, "property", "article:published_time"),
      METADATA_PUBLISHED_AT_LIMIT,
    ),
    canonicalUrl: readCanonicalUrl(document),
  };
  const product = readPageProduct(document);
  const schemaTypes = readPageTypes(document);

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      Object.assign(metadata, { [key]: value });
    }
  }

  if (schemaTypes !== undefined) {
    metadata.schemaTypes = schemaTypes;
  }

  if (product !== undefined) {
    metadata.product = product;
  }

  return Object.keys(metadata).length === 0 ? undefined : metadata;
};
