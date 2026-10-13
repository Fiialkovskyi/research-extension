import { generateStructured } from "@/features/inference";
import { getErrorMessage } from "@/shared/getErrorMessage";

import {
  CANCELLATION_DEADLINE_MS,
  EXTRACTED_PRODUCT_JSON_SCHEMA,
  EXTRACTION_INSTRUCTIONS,
  EXTRACTION_PROBES,
  EXTRACTION_TOLERANCE,
  LONG_ANSWER_PROMPT,
  MINIMUM_EXTRACTED_PROBES,
  TOKEN_LIMIT_PROBE_TOKENS,
} from "../../constants";
import { extractedProductSchema } from "../../schemas";
import type {
  ConformanceOutcome,
  ExtractionProbe,
  GenerateForConformance,
  ProbeResult,
} from "../../types";

const LONG_ANSWER = [{ role: "user" as const, content: LONG_ANSWER_PROMPT }];

/** Whether `actual` is within the tolerance of `expected`. */
const isClose = (actual: number, expected: number): boolean =>
  Math.abs(actual - expected) <= Math.abs(expected) * EXTRACTION_TOLERANCE;

/** A run asked for a long answer and cancelled at its first piece must say so, promptly. */
const probeCancellation = async (generate: GenerateForConformance): Promise<ProbeResult> => {
  const name = "stops when cancelled";
  const controller = new AbortController();
  const stream = generate({
    messages: LONG_ANSWER,
    maxTokens: 512,
    signal: controller.signal,
  });
  const first = await stream[Symbol.asyncIterator]().next();

  if (first.done === true) {
    return { name, passed: false, detail: "It answered nothing that could be cancelled." };
  }

  const cancelledAt = performance.now();

  controller.abort();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"late">((resolve) => {
    timer = setTimeout(() => {
      resolve("late");
    }, CANCELLATION_DEADLINE_MS);
  });
  const outcome = await Promise.race([stream.final(), deadline]);

  clearTimeout(timer);

  if (outcome === "late") {
    return {
      name,
      passed: false,
      detail: `It did not stop within ${CANCELLATION_DEADLINE_MS / 1000} s of being cancelled.`,
    };
  }

  const seconds = ((performance.now() - cancelledAt) / 1000).toFixed(2);

  return outcome.stoppedBecause === "cancelled"
    ? { name, passed: true, detail: `It stopped ${seconds} s after it was cancelled.` }
    : {
        name,
        passed: false,
        detail: `It reported "${outcome.stoppedBecause}" rather than being cancelled.`,
      };
};

/** A run with a small limit must stop at it, and say that is why. */
const probeTokenLimit = async (generate: GenerateForConformance): Promise<ProbeResult> => {
  const name = "stops at its token limit";
  const { stoppedBecause } = await generate({
    messages: LONG_ANSWER,
    maxTokens: TOKEN_LIMIT_PROBE_TOKENS,
  }).final();

  return stoppedBecause === "token-limit"
    ? {
        name,
        passed: true,
        detail: `It stopped at its limit of ${TOKEN_LIMIT_PROBE_TOKENS} tokens.`,
      }
    : {
        name,
        passed: false,
        detail: `With a limit of ${TOKEN_LIMIT_PROBE_TOKENS} tokens it reported "${stoppedBecause}".`,
      };
};

/** Why one passage's extraction is wrong, or `undefined` when it is right. */
const findExtractionError = async (
  generate: GenerateForConformance,
  { passage, expected }: ExtractionProbe,
): Promise<string | undefined> => {
  const outcome = await generateStructured({
    generate,
    request: {
      messages: [
        { role: "system", content: EXTRACTION_INSTRUCTIONS },
        { role: "user", content: passage },
      ],
      maxTokens: 256,
      temperature: 0,
      responseSchema: EXTRACTED_PRODUCT_JSON_SCHEMA,
    },
    schema: extractedProductSchema,
  });

  if (!outcome.ok) {
    return `${expected.name}: ${outcome.reason}`;
  }

  const { value } = outcome;

  if (!value.name.toLowerCase().includes(expected.name.toLowerCase())) {
    return `${expected.name}: named "${value.name}"`;
  }

  if (!isClose(value.priceUsd, expected.priceUsd)) {
    return `${expected.name}: price ${value.priceUsd}, expected ${expected.priceUsd}`;
  }

  if (!isClose(value.weightKg, expected.weightKg)) {
    return `${expected.name}: weight ${value.weightKg} kg, expected ${expected.weightKg}`;
  }

  return undefined;
};

/** The bundled passages, extracted one by one into a schema. */
const probeExtraction = async (generate: GenerateForConformance): Promise<ProbeResult> => {
  const errors: string[] = [];

  // One at a time: a local server answers one request at a time anyway, and a
  // burst would only measure its queue.
  for (const probe of EXTRACTION_PROBES) {
    const error = await findExtractionError(generate, probe);

    if (error !== undefined) {
      errors.push(error);
    }
  }

  const right = EXTRACTION_PROBES.length - errors.length;

  return {
    name: "extracts products into a schema",
    passed: right >= MINIMUM_EXTRACTED_PROBES,
    detail:
      `${right} of ${EXTRACTION_PROBES.length} extracted correctly, ${MINIMUM_EXTRACTED_PROBES} required` +
      (errors.length === 0 ? "" : ` (${errors.join("; ")})`),
  };
};

/**
 * Runs the text-generation family's conformance suite, through the model as
 * features will use it.
 *
 * Cancellation is probed first, so the probes after it also show that a
 * cancelled run released the runtime. Then a run must stop at a small token
 * limit, and bundled passages must be extracted into a schema with the right
 * values — validated, as every structured answer is, whatever the runtime
 * promised.
 *
 * Never throws: a model or runtime that fails yields a failed outcome with a
 * reason, so the caller refuses activation and explains why.
 */
export const runGenerationConformance = async (
  generate: GenerateForConformance,
): Promise<ConformanceOutcome> => {
  const probes: ProbeResult[] = [];

  try {
    probes.push(await probeCancellation(generate));
    probes.push(await probeTokenLimit(generate));
    probes.push(await probeExtraction(generate));
  } catch (error) {
    probes.push({ name: "runs at all", passed: false, detail: getErrorMessage(error) });
  }

  const failed = probes.find(({ passed }) => !passed);

  return failed === undefined
    ? { passed: true, probes }
    : { passed: false, probes, reason: `${failed.name}: ${failed.detail}` };
};
