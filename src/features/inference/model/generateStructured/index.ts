import * as v from "valibot";

import type { GenerateRequest, GenerateResult, GenerationStream } from "../../types";

/** What a structured generation produced: a validated value, or why there is none. */
export type StructuredOutcome<TValue> =
  | { ok: true; value: TValue; result: GenerateResult }
  | { ok: false; reason: string; result: GenerateResult };

export interface GenerateStructuredOptions<TSchema extends v.GenericSchema> {
  generate: (request: GenerateRequest) => GenerationStream;
  /** Carries the JSON schema the runtime is asked to constrain the answer to. */
  request: GenerateRequest & { responseSchema: Record<string, unknown> };
  /** What the extension trusts: the answer is accepted only if it passes this. */
  schema: TSchema;
}

/** A model that cannot constrain its output often wraps JSON in a Markdown fence. */
const FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/u;

/**
 * Generates an answer in a schema, and accepts it only if it validates.
 *
 * The runtime is asked to constrain its output, when it can; the answer is
 * validated regardless, since that constraint is the runtime's promise, not
 * one the extension can check any other way. An answer that is not JSON, does
 * not match the schema, or was cut short — by the token limit or a
 * cancellation, either of which leaves JSON incomplete — is discarded, never
 * passed on as a result.
 *
 * @throws What the generation itself throws, such as the server being away.
 */
export const generateStructured = async <TSchema extends v.GenericSchema>({
  generate,
  request,
  schema,
}: GenerateStructuredOptions<TSchema>): Promise<StructuredOutcome<v.InferOutput<TSchema>>> => {
  const result = await generate(request).final();

  if (result.stoppedBecause !== "model") {
    return {
      ok: false,
      reason:
        result.stoppedBecause === "cancelled"
          ? "The answer was cancelled before it finished."
          : `The answer reached its limit of ${request.maxTokens} tokens before it finished.`,
      result,
    };
  }

  const trimmed = result.text.trim();
  let parsed: unknown;

  try {
    parsed = JSON.parse(FENCE.exec(trimmed)?.[1] ?? trimmed);
  } catch {
    return { ok: false, reason: "The answer was not JSON.", result };
  }

  const validated = v.safeParse(schema, parsed);

  if (!validated.success) {
    const [issue] = validated.issues;
    const path = issue.path?.map(({ key }) => String(key)).join(".");

    return {
      ok: false,
      reason: `The answer did not match the schema${path === undefined || path === "" ? "" : ` at ${path}`}: ${issue.message}`,
      result,
    };
  }

  return { ok: true, value: validated.output, result };
};
