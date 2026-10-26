/** One fact, reduced to what ranking its concept needs. */
export interface ConceptFact {
  /** The column key of the fact's concept. */
  key: string;
  /** The entity the fact is about: a row, or a root entity. */
  entityId: string;
  /** The page that states it. */
  pageId: string;
  /** Its value, with its unit. */
  value: string;
}

/** What the facts say about one concept. */
export interface RankedConcept {
  key: string;
  /** How many different entities state it. */
  entityCount: number;
  /** How many different pages state it. */
  pageCount: number;
  /** Whether it says something: not prose, and not the same on every entity that states it. */
  isInformative: boolean;
  /** Whether it can be a proposed column: informative, and, among several entities, stated by more than one. */
  isSpec: boolean;
}
