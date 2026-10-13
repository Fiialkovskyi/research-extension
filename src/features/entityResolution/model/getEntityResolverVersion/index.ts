import { ENTITY_NAME_VERSION } from "../../constants";

/**
 * What resolves a page's entities: the name rules and the embedding model
 * names are compared with, or none. Part of the resolution job's identity.
 */
export const getEntityResolverVersion = (embeddingModelRef: string | undefined): string =>
  `${ENTITY_NAME_VERSION}|${embeddingModelRef ?? "none"}`;
