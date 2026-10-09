/**
 * The throughput benchmark.
 *
 * Its whole purpose is to produce a number that can be compared with the
 * target spec's budget honestly, so every input it depends on is fixed here
 * rather than left to whatever the caller happens to pass.
 */

/** Words per chunk, matching the chunk size the synthesis pipeline targets. */
export const BENCHMARK_CHUNK_WORDS = 220;

/**
 * Chunks per run.
 *
 * Enough that start-up cost is amortised and a stray pause does not dominate,
 * small enough that a run on the software path finishes in well under a minute
 * even if throughput turns out to be poor.
 */
export const BENCHMARK_CHUNK_COUNT = 40;

/**
 * Chunks embedded and discarded before the clock starts.
 *
 * The runtime builds its inference session on first use, so the first batch of
 * any size pays for it. A couple of chunks is enough to absorb that without
 * meaningfully extending the run.
 */
export const WARM_UP_CHUNKS = 2;

/** The budget this measurement is judged against (NFR-004). */
export const MINIMUM_CHUNKS_PER_SECOND = 20;

/**
 * Vocabulary the benchmark text is drawn from.
 *
 * Synthetic rather than scraped: real page text cannot be bundled without
 * either shipping someone's content or fetching at measurement time, and
 * neither belongs in a benchmark that has to be reproducible offline. What
 * matters for tokenizer and encoder cost is the length and the variety of
 * tokens, which sampling a mixed vocabulary reproduces well enough to compare
 * two compute paths against each other.
 *
 * It is not good enough to judge *quality* — nothing here is used for that.
 */
export const BENCHMARK_VOCABULARY: readonly string[] = [
  "battery",
  "capacity",
  "range",
  "motor",
  "torque",
  "frame",
  "aluminium",
  "carbon",
  "warranty",
  "service",
  "interval",
  "charger",
  "voltage",
  "controller",
  "firmware",
  "review",
  "comparison",
  "measured",
  "claimed",
  "manufacturer",
  "retailer",
  "forum",
  "commuting",
  "touring",
  "gravel",
  "hub",
  "derailleur",
  "brake",
  "rotor",
  "pad",
  "suspension",
  "travel",
  "geometry",
  "reach",
  "stack",
  "weight",
  "payload",
  "rack",
  "mudguard",
  "light",
  "lumens",
  "waterproof",
  "rating",
  "ingress",
  "protection",
  "study",
  "evidence",
  "sample",
  "method",
  "result",
  "conclusion",
  "limitation",
  "although",
  "however",
  "therefore",
  "whereas",
  "moreover",
  "nevertheless",
  "approximately",
  "roughly",
  "between",
  "during",
  "without",
  "alongside",
  "despite",
  "kilometre",
  "kilogram",
  "percent",
  "hour",
  "watt",
  "newton",
  "metre",
  "degree",
];
