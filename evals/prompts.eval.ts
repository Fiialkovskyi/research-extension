// The prompt evals (`npm run eval`): the extension's own pipeline over the saved pages, against the
// local Ollama. Not part of `npm run verify` or `npm run test`; see `AGENTS.md`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import * as v from "valibot";
import { it } from "vitest";

import {
  BASELINE_PATH,
  DEFAULT_EVAL_EMBEDDING_MODEL,
  DEFAULT_EVAL_MODEL,
  FIXTURES_DIRECTORY,
  REPORTS_DIRECTORY,
} from "./constants";
import { baselineSchema } from "./schemas";
import type { Fixture, Metrics, RunDetails } from "./types";
import { averageMetrics } from "./utils/averageMetrics";
import { buildProductCardLines } from "./utils/buildProductCardLines";
import { computeMetrics } from "./utils/computeMetrics";
import { connectOllama } from "./utils/connectOllama";
import { formatReport } from "./utils/formatReport";
import { matchFacts } from "./utils/matchFacts";
import { readFixtures } from "./utils/readFixtures";
import { readPageForEvals } from "./utils/readPageForEvals";
import { type ExtractionResult, runExtraction } from "./utils/runExtraction";
import { runSession } from "./utils/runSession";
import { scoreMerges } from "./utils/scoreMerges";

const write = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

/** The baseline file's numbers, or none when there is no file yet. */
const readBaseline = (): v.InferOutput<typeof baselineSchema> | undefined =>
  existsSync(BASELINE_PATH)
    ? v.parse(baselineSchema, JSON.parse(readFileSync(BASELINE_PATH, "utf8")))
    : undefined;

it("measures the extraction and summary prompts on the saved pages", async () => {
  const generation = process.env["EVAL_MODEL"] ?? DEFAULT_EVAL_MODEL;
  const embeddingName = process.env["EVAL_EMBEDDING_MODEL"] ?? DEFAULT_EVAL_EMBEDDING_MODEL;
  const embedding = embeddingName === "none" ? undefined : embeddingName;
  const runCount = Math.max(1, Number(process.env["EVAL_RUNS"] ?? 1));
  const { fixtures, skipped } = readFixtures(FIXTURES_DIRECTORY);

  for (const { id, reason } of skipped) {
    write(`Skipped ${id}: ${reason}.`);
  }

  if (fixtures.length === 0) {
    throw new Error(
      `No fixture to run in ${FIXTURES_DIRECTORY}. Add one with npm run eval:capture.`,
    );
  }

  const { generate, embed } = await connectOllama(fetch, {
    generation,
    ...(embedding === undefined ? {} : { embedding }),
  });
  const products = fixtures.flatMap(({ labels }) => labels.products);
  const runs: { metrics: Metrics; details: RunDetails }[] = [];

  for (let run = 1; run <= runCount; run += 1) {
    const extractions: { fixture: Fixture; result: ExtractionResult }[] = [];

    for (const fixture of fixtures) {
      extractions.push({
        fixture,
        result: await runExtraction(readPageForEvals(fixture.html), generate),
      });
    }

    const session = await runSession(
      extractions.map(({ fixture, result }) => ({ id: fixture.id, facts: result.facts })),
      generate,
      embed,
    );
    const matches = extractions.map(({ fixture, result }) => ({
      id: fixture.id,
      ...matchFacts(fixture.labels.facts, result.facts),
    }));
    const sum = (read: (entry: (typeof extractions)[number]) => number): number =>
      extractions.reduce((total, entry) => total + read(entry), 0);
    const metrics = computeMetrics({
      answered: sum(({ result }) => result.answered),
      ungrounded: sum(({ result }) => result.ungrounded),
      junk: sum(({ result }) => result.junk),
      extractionRequests: sum(({ result }) => result.requestCount),
      invalidChunks: sum(({ result }) => result.invalidChunks),
      truncatedChunks: sum(({ result }) => result.truncatedChunks),
      labelled: sum(({ fixture }) => fixture.labels.facts.length),
      found: matches.reduce((total, { found }) => total + found.length, 0),
      merge: scoreMerges(session.keys, {
        sameConcept: fixtures.flatMap(({ labels }) => labels.sameConcept),
        differentConcept: fixtures.flatMap(({ labels }) => labels.differentConcept),
      }),
      statementCount: session.statements.length,
      statementsNamingProduct: session.statements.filter((statement) =>
        products.some((product) => statement.toLowerCase().includes(product.toLowerCase())),
      ).length,
      statementsComparing: session.statements.filter(
        (statement) =>
          products.filter((product) => statement.toLowerCase().includes(product.toLowerCase()))
            .length > 1,
      ).length,
      cardCount: session.cards.length,
      durationMs: sum(({ result }) => result.durationMs) + session.durationMs,
      requestCount: sum(({ result }) => result.requestCount) + session.requestCount,
    });

    const details: RunDetails = {
      fixtures: extractions.map(({ fixture, result }) => ({
        id: fixture.id,
        answered: result.answered,
        kept: result.facts.length,
        facts: result.facts.map(
          ({ subject, attribute, concept, value, unit }) =>
            `${subject} | ${attribute} | ${concept} | ${value}${unit === undefined ? "" : ` ${unit}`}`,
        ),
        missing: matches.find(({ id }) => id === fixture.id)?.missing ?? [],
      })),
      cards: buildProductCardLines(session.cards),
      statements: session.statements,
    };

    runs.push({ metrics, details });
    write(`\nRun ${run} of ${runCount}`);

    for (const { id, answered, kept, missing } of details.fixtures) {
      write(
        `  ${id}: ${kept} facts kept of ${answered} answered; not found: ${
          missing.map(({ value }) => value).join(", ") || "none"
        }`,
      );
    }
  }

  const mean = averageMetrics(runs.map(({ metrics }) => metrics));
  const last = runs.at(-1)?.details;

  write(`\nModel ${generation}, embeddings ${embedding ?? "off"}, ${runCount} run(s)\n`);
  write(formatReport(mean, readBaseline()));
  write(`\nCards of the last run:\n${last?.cards.join("\n") || "  none"}`);
  write(
    `\nSummary of the last run:\n${last?.statements.map((text) => `  - ${text}`).join("\n") || "  none"}`,
  );

  mkdirSync(REPORTS_DIRECTORY, { recursive: true });

  const reportPath = `${REPORTS_DIRECTORY}/${new Date().toISOString().replaceAll(/[:.]/gu, "-")}.json`;

  writeFileSync(
    reportPath,
    `${JSON.stringify({ generation, embedding: embedding ?? null, mean, runs }, undefined, 2)}\n`,
  );
  write(`\nReport: ${reportPath}`);

  if (process.env["EVAL_UPDATE_BASELINE"] === "1") {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(mean, undefined, 2)}\n`);
    write(`Baseline updated: ${BASELINE_PATH}`);
  }
});
