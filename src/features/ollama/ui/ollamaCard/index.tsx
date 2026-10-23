import { useCallback, useEffect, useState } from "react";

import {
  benchmarkResponseSchemas,
  type ExtractionMeasurement,
  generationBenchmarkResponseSchemas,
  MAXIMUM_EXTRACTION_MS,
} from "@/features/inferenceBenchmark";
import { liveDataResponseSchemas } from "@/features/liveData";
import { modelRegistryResponseSchemas } from "@/features/modelRegistry";
import {
  buildRpcMessage,
  parseRpcMessage,
  type RpcMessage,
  RpcMessageError,
  rpcResponseSchemas,
} from "@/shared/rpc";
import { Button, CopyableCommand, StatusDot } from "@/shared/ui";

import { ollamaResponseSchemas } from "../../schemas";
import type { OllamaModelEntry } from "../../types";

/** The options page's connection to the background, shared with the rest of the page. */
export interface OllamaCardClient {
  send: (message: RpcMessage<string, unknown>) => void;
  subscribe: (listener: (message: unknown) => void) => () => void;
}

export interface OllamaCardProps {
  client: OllamaCardClient;
}

type ServerState = "loading" | "notConnected" | "unreachable" | "refused" | "running";

/** What the list says in place of the models while Ollama cannot give them. */
const SERVER_STATE_TEXT: Record<Exclude<ServerState, "running">, string> = {
  loading: "Asking Ollama…",
  notConnected: "AI isn't set up yet.",
  unreachable: "Ollama isn't running.",
  refused: "Ollama is refusing this extension.",
};

/** What one model is doing right now, beyond what the server says. */
type ModelActivity =
  | { kind: "pulling"; percent: number | undefined }
  | { kind: "registering" }
  | { kind: "checking" }
  | { kind: "failed"; reason: string };

const responseSchemas = {
  ...ollamaResponseSchemas,
  ...liveDataResponseSchemas,
  ...modelRegistryResponseSchemas,
  ...benchmarkResponseSchemas,
  ...generationBenchmarkResponseSchemas,
  ...rpcResponseSchemas,
} as const;

/** How timing extraction from a page went. */
type ExtractionState =
  | { status: "running"; elapsedMs?: number; characters?: number }
  | { status: "measured"; measurement: ExtractionMeasurement }
  | { status: "failed"; reason: string };

/** Says how timing extraction went, against the budget for it. */
function ExtractionResult({ state }: { state: ExtractionState }) {
  if (state.status === "running") {
    return (
      <span data-testid="ollama-extraction" className="flex items-center gap-2">
        <StatusDot tone="busy" />
        Extracting facts from a test page…
        {state.elapsedMs !== undefined &&
          ` ${Math.round(state.elapsedMs / 1000)} s, ${state.characters ?? 0} characters written`}
      </span>
    );
  }

  if (state.status === "failed") {
    return (
      <span
        data-testid="ollama-extraction"
        className="flex items-center gap-2 text-red-700 dark:text-red-400"
      >
        <StatusDot tone="bad" />
        {state.reason}
      </span>
    );
  }

  const { measurement } = state;
  const seconds = (measurement.durationMs / 1000).toFixed(1);
  const budget = MAXIMUM_EXTRACTION_MS / 1000;

  // Amber when fast enough but partly wrong: the time passed, the table did not.
  const tone = !measurement.meetsBudget
    ? "bad"
    : measurement.correctCount === measurement.expectedCount
      ? "ok"
      : "attention";

  return (
    <span data-testid="ollama-extraction" className="flex items-center gap-2">
      <StatusDot tone={tone} />
      {measurement.isValid
        ? `A comparison table from a ${measurement.wordCount}-word page in ${seconds} s — ${measurement.meetsBudget ? "within" : "over"} the ${budget} s budget; ${measurement.correctCount} of ${measurement.expectedCount} values right.`
        : `The answer was discarded after ${seconds} s: ${measurement.reason ?? "it did not match the schema."}`}
    </span>
  );
}

/**
 * The models Ollama has, under the options page's "Advanced": use another one,
 * download one, or measure the ones that are on. Turning AI on in the first
 * place is the setup page's job, so nothing here walks the user through it.
 */
export function OllamaCard({ client }: OllamaCardProps) {
  const [server, setServer] = useState<ServerState>("loading");
  const [models, setModels] = useState<OllamaModelEntry[]>([]);
  const [activity, setActivity] = useState<Record<string, ModelActivity>>({});
  const [extraction, setExtraction] = useState<ExtractionState | undefined>();
  const [throughput, setThroughput] = useState<number | undefined>();

  const refresh = useCallback(() => {
    client.send(buildRpcMessage("ollama.status", {}));
  }, [client]);

  useEffect(() => {
    const unsubscribe = client.subscribe((message) => {
      let response;

      try {
        response = parseRpcMessage(message, responseSchemas);
      } catch (error) {
        if (error instanceof RpcMessageError) {
          return;
        }

        throw error;
      }

      switch (response.type) {
        case "ollama.state":
          setServer(response.payload.state);
          setModels(response.payload.models);
          break;
        case "data.changed":
          // Access was granted or withdrawn, or a model changed, somewhere else.
          if (response.payload.topics.some((topic) => topic === "access" || topic === "models")) {
            client.send(buildRpcMessage("ollama.status", {}));
          }

          break;
        case "generation.measured":
          setExtraction({ status: "measured", measurement: response.payload });
          break;
        case "generation.measureProgress": {
          const { elapsedMs, characters } = response.payload;

          setExtraction((previous) =>
            previous?.status === "running"
              ? { status: "running", elapsedMs, characters }
              : previous,
          );
          break;
        }
        case "generation.measureFailed":
          setExtraction({ status: "failed", reason: response.payload.reason });
          break;
        case "ollama.pullProgress": {
          const { name, completed, total } = response.payload;

          setActivity((previous) => ({
            ...previous,
            [name]: {
              kind: "pulling",
              percent:
                total === undefined || completed === undefined
                  ? undefined
                  : Math.round((completed / total) * 100),
            },
          }));
          break;
        }
        case "ollama.pulled":
          setActivity(({ [response.payload.name]: _done, ...rest }) => rest);
          client.send(buildRpcMessage("ollama.status", {}));
          break;
        case "ollama.registered":
          setActivity((previous) => ({
            ...previous,
            [response.payload.name]: { kind: "checking" },
          }));
          client.send(buildRpcMessage("model.activate", { ref: response.payload.ref }));
          break;
        case "ollama.pullFailed":
        case "ollama.registerFailed":
          setActivity((previous) => ({
            ...previous,
            [response.payload.name]: { kind: "failed", reason: response.payload.reason },
          }));
          break;
        case "model.activated":
          setActivity((previous) => {
            const next = { ...previous };

            for (const [name, step] of Object.entries(next)) {
              if (step.kind === "checking") {
                if (response.payload.active) {
                  delete next[name];
                } else {
                  next[name] = {
                    kind: "failed",
                    reason: response.payload.reason ?? "It did not pass the quality check.",
                  };
                }
              }
            }

            return next;
          });
          client.send(buildRpcMessage("ollama.status", {}));
          break;
        case "model.activationFailed":
          setActivity((previous) =>
            Object.fromEntries(
              Object.entries(previous).map(([name, step]) => [
                name,
                step.kind === "checking"
                  ? { kind: "failed", reason: response.payload.reason }
                  : step,
              ]),
            ),
          );
          break;
        case "benchmark.measured":
          if (response.payload.device === "local-server") {
            setThroughput(response.payload.chunksPerSecond);
          }

          break;
        default:
          break;
      }
    });

    client.send(buildRpcMessage("ollama.status", {}));

    return unsubscribe;
  }, [client]);

  const activeGenerationModel = models.find(
    ({ family, isActive }) => family === "text-generation" && isActive,
  );
  const listedModels = models.filter(({ family }) => family !== "unknown");

  const measureExtraction = () => {
    setExtraction({ status: "running" });
    client.send(buildRpcMessage("generation.measure", {}));
  };

  return (
    <section data-testid="ollama-card" data-state={server} className="flex flex-col gap-3 text-sm">
      <h3 className="font-medium">Ollama models</h3>

      {server !== "running" && (
        <p data-testid="ollama-not-running" className="flex items-center gap-2">
          <StatusDot tone={server === "loading" ? "busy" : "idle"} />
          {SERVER_STATE_TEXT[server]}
          <button
            type="button"
            data-testid="ollama-recheck"
            className="underline"
            onClick={refresh}
          >
            Check now
          </button>
        </p>
      )}

      {server === "running" && activeGenerationModel !== undefined && (
        <div data-testid="ollama-summaries" className="flex flex-col items-start gap-1">
          <p data-testid="ollama-summaries-on" className="flex items-center gap-2 font-medium">
            <StatusDot tone="ok" />
            Page summaries are on, using {activeGenerationModel.name}.
          </p>
          <Button
            data-testid="ollama-measure-extraction"
            disabled={extraction?.status === "running"}
            onClick={measureExtraction}
          >
            Measure extraction time
          </Button>
          {extraction !== undefined && <ExtractionResult state={extraction} />}
        </div>
      )}

      {server === "running" && (
        <ul data-testid="ollama-models" className="flex flex-col gap-2 text-xs">
          {listedModels.length === 0 && <li>Ollama has no model the extension can use yet.</li>}
          {listedModels.map((model) => {
            const step = activity[model.name];

            return (
              <li key={model.name} data-testid="ollama-model" data-model={model.name}>
                <span className="font-medium">{model.name}</span>{" "}
                <span className="text-slate-500 dark:text-slate-400">
                  {model.family === "text-generation" ? "writes text · " : "embeddings · "}
                  {model.size}
                  {model.isRecommended && " · recommended"}
                </span>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {model.isActive && (
                    <>
                      <span data-testid="ollama-active" className="flex items-center gap-1.5">
                        <StatusDot tone="ok" />
                        Active
                      </span>
                      {model.family === "embedding" && (
                        <Button
                          data-testid="ollama-measure"
                          onClick={() => {
                            if (model.registeredRef !== null) {
                              client.send(
                                buildRpcMessage("benchmark.run", {
                                  ref: model.registeredRef,
                                }),
                              );
                            }
                          }}
                        >
                          Measure speed
                        </Button>
                      )}
                      {throughput !== undefined && (
                        <span data-testid="ollama-throughput">
                          {throughput.toFixed(1)} chunks/s
                        </span>
                      )}
                    </>
                  )}
                  {!model.isPulled && step === undefined && (
                    <>
                      <Button
                        data-testid="ollama-pull"
                        onClick={() => {
                          setActivity((previous) => ({
                            ...previous,
                            [model.name]: { kind: "pulling", percent: undefined },
                          }));
                          client.send(buildRpcMessage("ollama.pull", { name: model.name }));
                        }}
                      >
                        Download in Ollama
                      </Button>
                      <span>
                        or run{" "}
                        <CopyableCommand
                          text={`ollama pull ${model.name}`}
                          testId="ollama-pull-command"
                        />
                      </span>
                    </>
                  )}
                  {model.isPulled && !model.isActive && step === undefined && (
                    <Button
                      data-testid="ollama-use"
                      onClick={() => {
                        setActivity((previous) => ({
                          ...previous,
                          [model.name]: { kind: "registering" },
                        }));
                        client.send(buildRpcMessage("ollama.register", { name: model.name }));
                      }}
                    >
                      Use {model.name}
                    </Button>
                  )}
                  {step?.kind === "pulling" && (
                    <span data-testid="ollama-progress">
                      Downloading{step.percent === undefined ? "…" : ` ${step.percent}%`}
                    </span>
                  )}
                  {step?.kind === "registering" && (
                    <span data-testid="ollama-progress">Registering…</span>
                  )}
                  {step?.kind === "checking" && (
                    <span data-testid="ollama-progress">Checking quality…</span>
                  )}
                  {step?.kind === "failed" && (
                    <span className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
                      <StatusDot tone="bad" />
                      <span data-testid="ollama-failure" role="alert">
                        {step.reason}
                      </span>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs">
        Start Ollama without the app (Linux):{" "}
        <CopyableCommand text="ollama serve" testId="ollama-serve-command" />
      </p>
    </section>
  );
}
