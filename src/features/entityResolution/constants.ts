/** The version of the unit table and number rules, for anything that records it. */
export const UNIT_NORMALIZER_VERSION = "unitNormalizer@1";

/**
 * Units `readNormalizedValue` converts, keyed by their spelling with case,
 * spaces, dots and `·` removed: each to its family's base unit, by a factor.
 * English, Ukrainian and Russian spellings.
 */
export const NORMALIZED_UNITS: Readonly<Record<string, { unit: string; factor: number }>> = {
  // Mass → kg
  g: { unit: "kg", factor: 0.001 },
  г: { unit: "kg", factor: 0.001 },
  гр: { unit: "kg", factor: 0.001 },
  kg: { unit: "kg", factor: 1 },
  кг: { unit: "kg", factor: 1 },
  lb: { unit: "kg", factor: 0.453_592_37 },
  lbs: { unit: "kg", factor: 0.453_592_37 },
  oz: { unit: "kg", factor: 0.028_349_523_125 },
  // Length → mm
  mm: { unit: "mm", factor: 1 },
  мм: { unit: "mm", factor: 1 },
  cm: { unit: "mm", factor: 10 },
  см: { unit: "mm", factor: 10 },
  m: { unit: "mm", factor: 1000 },
  м: { unit: "mm", factor: 1000 },
  in: { unit: "mm", factor: 25.4 },
  inch: { unit: "mm", factor: 25.4 },
  inches: { unit: "mm", factor: 25.4 },
  '"': { unit: "mm", factor: 25.4 },
  дюйм: { unit: "mm", factor: 25.4 },
  дюйми: { unit: "mm", factor: 25.4 },
  дюймов: { unit: "mm", factor: 25.4 },
  // Distance → km
  km: { unit: "km", factor: 1 },
  км: { unit: "km", factor: 1 },
  mi: { unit: "km", factor: 1.609_344 },
  mile: { unit: "km", factor: 1.609_344 },
  miles: { unit: "km", factor: 1.609_344 },
  // Energy → Wh; battery charge stays mAh, which needs a voltage to convert
  wh: { unit: "Wh", factor: 1 },
  втгод: { unit: "Wh", factor: 1 },
  втч: { unit: "Wh", factor: 1 },
  kwh: { unit: "Wh", factor: 1000 },
  mah: { unit: "mAh", factor: 1 },
  мачас: { unit: "mAh", factor: 1 },
  мач: { unit: "mAh", factor: 1 },
  // Power → W
  w: { unit: "W", factor: 1 },
  вт: { unit: "W", factor: 1 },
  kw: { unit: "W", factor: 1000 },
  квт: { unit: "W", factor: 1000 },
  // Torque → N·m
  nm: { unit: "N·m", factor: 1 },
  нм: { unit: "N·m", factor: 1 },
  // Time → s
  s: { unit: "s", factor: 1 },
  sec: { unit: "s", factor: 1 },
  с: { unit: "s", factor: 1 },
  min: { unit: "s", factor: 60 },
  хв: { unit: "s", factor: 60 },
  мин: { unit: "s", factor: 60 },
  h: { unit: "s", factor: 3600 },
  hr: { unit: "s", factor: 3600 },
  год: { unit: "s", factor: 3600 },
  ч: { unit: "s", factor: 3600 },
  // Storage → GB
  gb: { unit: "GB", factor: 1 },
  гб: { unit: "GB", factor: 1 },
  tb: { unit: "GB", factor: 1000 },
  тб: { unit: "GB", factor: 1000 },
  // Kept as written
  "%": { unit: "%", factor: 1 },
};

/** How similar two names' embeddings must be for their entities to merge (SYN step 6). */
export const ENTITY_SIMILARITY_THRESHOLD = 0.85;

/** The type of a subject whose type is not known; it matches any type by name. */
export const UNKNOWN_TYPE = "unknown";

/** The job that assigns a page's facts to the session's entities. */
export const RESOLVE_ENTITIES_JOB = "resolveEntities";

/** The name rules matching uses; part of the job's identity. */
export const ENTITY_NAME_VERSION = "entityName@1";

/** Names embedded per request, as the embedding job batches chunks. */
export const ENTITY_EMBEDDING_BATCH_SIZE = 8;
