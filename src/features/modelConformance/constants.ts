import type { ExtractionProbe, ParaphraseProbe } from "./types";

/**
 * The bundled conformance suite for the embedding family.
 *
 * A model that loads is not a model that works. These probes are what stands
 * between "the runtime returned some numbers" and letting a feature rely on
 * them, because the failure mode of a wrongly-configured encoder is not an
 * error — it is vectors of the right width and unit length that encode nothing.
 */

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

/**
 * The bundled conformance suite for the text-generation family: passages that
 * each describe one product, to be extracted into a schema.
 *
 * Each carries a distractor — a second price, a second weight, a figure in
 * other units — because a model that copies the first number it sees would
 * otherwise pass. One gives its weight in grams, to be answered in kilograms.
 */
export const EXTRACTION_PROBES: readonly ExtractionProbe[] = [
  {
    passage:
      "The Brewline K2 kettle sells for $49.99, down from its launch price of $64. It holds 1.7 litres and weighs 1.2 kg empty; the box adds another 400 g.",
    expected: { name: "Brewline K2", priceUsd: 49.99, weightKg: 1.2 },
  },
  {
    passage:
      "Trailhead's Ridge 30 backpack is a 30-litre daypack priced at $129. At 850 g it is lighter than the Ridge 40, which weighs 1.1 kg and costs $159.",
    expected: { name: "Ridge 30", priceUsd: 129, weightKg: 0.85 },
  },
  {
    passage:
      "We tested the Volta E5 e-bike over 300 km. It weighs 23.5 kg with its 500 Wh battery and costs $2,399, plus $80 for delivery.",
    expected: { name: "Volta E5", priceUsd: 2399, weightKg: 23.5 },
  },
  {
    passage:
      "The Lumen Desk 14 laptop starts at $1,049 for 16 GB of memory. It weighs 1.35 kg, and its 65 W charger adds 0.3 kg to a travel bag.",
    expected: { name: "Lumen Desk 14", priceUsd: 1049, weightKg: 1.35 },
  },
  {
    passage:
      "Priced at $349, the Northwind 2 tent sleeps two and packs down to 2.1 kg. Its footprint, sold separately for $45, weighs 0.4 kg.",
    expected: { name: "Northwind 2", priceUsd: 349, weightKg: 2.1 },
  },
];

/** Extraction probes a generation model must get right, of five. */
export const MINIMUM_EXTRACTED_PROBES = 4;

/** How far an extracted number may be from the expected one, relative to it. */
export const EXTRACTION_TOLERANCE = 0.01;

/** The JSON schema extraction answers are constrained to; mirrors `extractedProductSchema`. */
export const EXTRACTED_PRODUCT_JSON_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    priceUsd: { type: "number" },
    weightKg: { type: "number" },
  },
  required: ["name", "priceUsd", "weightKg"],
} as const;

/** Instructions for each extraction probe. */
export const EXTRACTION_INSTRUCTIONS =
  "Extract the main product the passage describes. Answer with JSON only: its name, its price in US dollars as a number, and its own weight in kilograms as a number.";

/** A request whose honest answer is far longer than any limit the stopping probes set. */
export const LONG_ANSWER_PROMPT =
  "Count from 1 to 500, writing every number in words, separated by commas.";

/** The token limit the limit probe sets: well below what the long answer needs. */
export const TOKEN_LIMIT_PROBE_TOKENS = 16;

/** How soon a cancelled run must report that it stopped. */
export const CANCELLATION_DEADLINE_MS = 5_000;
