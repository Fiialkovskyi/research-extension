import type { EmbeddingRole } from "@/features/inference";

/**
 * The bundled conformance suite for the embedding family.
 *
 * A model that loads is not a model that works. These probes are what stands
 * between "the runtime returned some numbers" and letting a feature rely on
 * them, because the failure mode of a wrongly-configured encoder is not an
 * error — it is vectors of the right width and unit length that encode nothing.
 */

/**
 * Embeds a batch of texts in a role.
 *
 * Injected throughout the suite rather than imported, so every probe runs
 * against a stub and each failure mode is reachable without a real model.
 */
export type EmbedForConformance = (
  texts: readonly string[],
  role: EmbeddingRole,
) => Promise<Float32Array[]>;

/** A probe pair: the paraphrase should sit closer to the anchor than the stranger. */
export interface ParaphraseProbe {
  anchor: string;
  paraphrase: string;
  unrelated: string;
}

/**
 * Twenty pairs spanning everyday topics rather than one domain.
 *
 * Deliberately not research-specific: the point is to catch a model that is
 * broken or misconfigured, not to measure how well it suits our subject matter.
 * A suite drawn from one domain would pass a model that happens to cluster that
 * vocabulary and fail one that is simply unfamiliar with it.
 */
export const PARAPHRASE_PROBES: readonly ParaphraseProbe[] = [
  {
    anchor: "How do I reset my password?",
    paraphrase: "What is the process for changing my password?",
    unrelated: "The volcano erupted for the third time this decade.",
  },
  {
    anchor: "The train to Berlin leaves at noon.",
    paraphrase: "There is a midday departure for Berlin.",
    unrelated: "She prefers her coffee without sugar.",
  },
  {
    anchor: "This laptop has eight hours of battery life.",
    paraphrase: "The battery on this notebook lasts about eight hours.",
    unrelated: "Medieval cathedrals took centuries to complete.",
  },
  {
    anchor: "The film was far too long.",
    paraphrase: "That movie dragged on well past its welcome.",
    unrelated: "Copper conducts electricity better than iron.",
  },
  {
    anchor: "Where can I find the nearest pharmacy?",
    paraphrase: "Is there a chemist somewhere close by?",
    unrelated: "He has been learning the cello since April.",
  },
  {
    anchor: "Water boils at one hundred degrees Celsius.",
    paraphrase: "The boiling point of water is 100 °C.",
    unrelated: "The lease runs until the end of next year.",
  },
  {
    anchor: "My flight was delayed by three hours.",
    paraphrase: "The plane took off three hours behind schedule.",
    unrelated: "Sourdough needs a starter that is fed regularly.",
  },
  {
    anchor: "The restaurant does not take reservations.",
    paraphrase: "You cannot book a table at that place.",
    unrelated: "Neutrinos pass through most matter unimpeded.",
  },
  {
    anchor: "She wrote her thesis on coastal erosion.",
    paraphrase: "Her dissertation was about shorelines wearing away.",
    unrelated: "The recipe calls for two tablespoons of butter.",
  },
  {
    anchor: "This bicycle needs a new chain.",
    paraphrase: "The chain on my bike has to be replaced.",
    unrelated: "Parliament adjourned without reaching a decision.",
  },
  {
    anchor: "The museum is closed on Mondays.",
    paraphrase: "You cannot visit the gallery at the start of the week.",
    unrelated: "Honeybees navigate partly by polarised light.",
  },
  {
    anchor: "I need to renew my passport before July.",
    paraphrase: "My passport has to be renewed by the summer.",
    unrelated: "The alloy becomes brittle below freezing.",
  },
  {
    anchor: "The soup was much too salty.",
    paraphrase: "There was far too much salt in that soup.",
    unrelated: "Fibre-optic cable carries light rather than current.",
  },
  {
    anchor: "He commutes by bus every morning.",
    paraphrase: "His daily journey to work is on the bus.",
    unrelated: "The treaty was signed in the autumn of that year.",
  },
  {
    anchor: "This book is out of print.",
    paraphrase: "You can no longer buy that title new.",
    unrelated: "Glaciers deposit sediment as they retreat.",
  },
  {
    anchor: "The concert sold out within an hour.",
    paraphrase: "Tickets for the show were gone in under sixty minutes.",
    unrelated: "Enzymes lose activity outside a narrow pH range.",
  },
  {
    anchor: "My phone will not hold a charge.",
    paraphrase: "The battery in my handset drains almost immediately.",
    unrelated: "The orchard was planted shortly after the war.",
  },
  {
    anchor: "The garden needs watering twice a week.",
    paraphrase: "Water the plants two times every week.",
    unrelated: "Compilers often reorder independent instructions.",
  },
  {
    anchor: "She speaks Portuguese fluently.",
    paraphrase: "Her Portuguese is completely fluent.",
    unrelated: "The bridge was widened to four lanes.",
  },
  {
    anchor: "The parcel arrived damaged.",
    paraphrase: "My package turned up with the box crushed.",
    unrelated: "Sunspots follow a roughly eleven-year cycle.",
  },
];

/** How many pairs must be ordered correctly for the suite to pass. */
export const MINIMUM_ORDERED_PROBES = 18;

/** Re-embedding identical text must reproduce the vector this closely. */
export const MINIMUM_DETERMINISM_SIMILARITY = 0.999;

/** How far a normalized vector's length may stray from one. */
export const NORM_TOLERANCE = 1e-3;
