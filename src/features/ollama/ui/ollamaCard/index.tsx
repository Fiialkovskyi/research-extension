import { useCallback, useEffect, useState } from "react";

import { benchmarkResponseSchemas } from "@/features/inferenceBenchmark";
import { modelRegistryResponseSchemas } from "@/features/modelRegistry";
import { OLLAMA_DOWNLOAD_URL, OLLAMA_PROFILES } from "@/shared/config";
import {
  buildRpcMessage,
  parseRpcMessage,
  type RpcMessage,
  RpcMessageError,
  rpcResponseSchemas,
} from "@/shared/rpc";
import { Button, StatusDot } from "@/shared/ui";

import {
  buildOllamaOriginsCommand,
  type OllamaPlatform,
} from "../../model/buildOllamaOriginsCommand";
import { ollamaResponseSchemas } from "../../schemas";
import type { OllamaModelEntry } from "../../types";

/** The options page's connection to the background, shared with the rest of the page. */
export interface OllamaCardClient {
  send: (message: RpcMessage<string, unknown>) => void;
  subscribe: (listener: (message: unknown) => void) => () => void;
}

export interface OllamaCardProps {
  client: OllamaCardClient;
  /**
   * Asks the browser for access to the local server. Called within the user's
   * click, before anything is awaited, as Firefox requires.
   */
  requestAccess: () => Promise<boolean>;
  /** This installation's origin, which the "allow this extension" command names. */
  extensionOrigin: string;
  /** Which operating system to write that command for. */
  platform: OllamaPlatform;
  /** How often to check again while a step is not done. */
  recheckIntervalMs?: number;
}

type ServerState = "loading" | "notConnected" | "unreachable" | "refused" | "running";

/** What one model is doing right now, beyond what the server says. */
type ModelActivity =
  | { kind: "pulling"; percent: number | undefined }
  | { kind: "registering" }
  | { kind: "checking" }
  | { kind: "failed"; reason: string };

/** Where turning local AI on has got to. */
type EnableProgress =
  | { stage: "downloading"; percent: number | undefined }
  | { stage: "checking" }
  | { stage: "failed"; reason: string };

const responseSchemas = {
  ...ollamaResponseSchemas,
  ...modelRegistryResponseSchemas,
  ...benchmarkResponseSchemas,
  ...rpcResponseSchemas,
} as const;

/** The model "Turn on local AI" uses: the recommended embedding model. */
const RECOMMENDED = OLLAMA_PROFILES.find(
  ({ family, isRecommended }) => family === "embedding" && isRecommended,
);

/** A command the user runs themselves, with a button that copies it. */
function Command({ text, testId }: { text: string; testId: string }) {
  const [isCopied, setIsCopied] = useState(false);

  return (
    <span className="flex items-start gap-2">
      <code
        data-testid={testId}
        className="rounded bg-slate-100 px-1 py-0.5 text-xs break-all dark:bg-slate-800"
      >
        {text}
      </code>
      <button
        type="button"
        className="shrink-0 text-xs underline"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => {
            setIsCopied(true);
          });
        }}
      >
        {isCopied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

/** How each step's circle looks: green and ticked, amber to do now, grey for later. */
const STEP_MARKERS = {
  done: "bg-emerald-500 text-white",
  current: "border-2 border-amber-400 text-amber-700 dark:text-amber-300",
  pending: "border border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-500",
} as const;

/** What each step's circle says to someone who cannot see its colour. */
const STEP_LABELS = { done: "Done", current: "To do now", pending: "Later" } as const;

/** One step of the checklist: done, the one to do now, or later. */
function Step({
  number,
  title,
  status,
  testId,
  children,
}: {
  number: number;
  title: string;
  status: "done" | "current" | "pending";
  testId: string;
  children?: React.ReactNode;
}) {
  return (
    <li data-testid={testId} data-status={status} className="flex gap-2">
      <span
        role="img"
        aria-label={STEP_LABELS[status]}
        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${STEP_MARKERS[status]}`}
      >
        {status === "done" ? "✓" : number}
      </span>
      <div className="flex flex-col gap-1">
        <span
          className={status === "current" ? "font-medium" : "text-slate-500 dark:text-slate-400"}
        >
          {title}
        </span>
        {status !== "done" && children}
      </div>
    </li>
  );
}

/**
 * The optional "Local AI with Ollama" section of the options page.
 *
 * Closed until the user opens it or has connected. Once the user chooses to set
 * it up, a short checklist in plain language takes them from installing Ollama
 * to local AI being on; its steps tick themselves from what the extension sees,
 * checked again every few seconds. The model list and the commands a seasoned
 * user may prefer sit under "More".
 */
export function OllamaCard({
  client,
  requestAccess,
  extensionOrigin,
  platform,
  recheckIntervalMs = 5_000,
}: OllamaCardProps) {
  const [server, setServer] = useState<ServerState>("loading");
  const [models, setModels] = useState<OllamaModelEntry[]>([]);
  const [activity, setActivity] = useState<Record<string, ModelActivity>>({});
  const [enabling, setEnabling] = useState<EnableProgress | undefined>();
  const [throughput, setThroughput] = useState<number | undefined>();
  const [isOpen, setIsOpen] = useState(false);

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

          // Someone who has connected comes back to it; open it for them.
          if (response.payload.state !== "notConnected") {
            setIsOpen(true);
          }

          break;
        case "ollama.enableProgress":
          setEnabling(
            response.payload.stage === "downloading"
              ? { stage: "downloading", percent: response.payload.percent }
              : { stage: "checking" },
          );
          break;
        case "ollama.enabled":
          setEnabling(undefined);
          client.send(buildRpcMessage("ollama.status", {}));
          break;
        case "ollama.enableFailed":
          setEnabling({
            stage: "failed",
            reason:
              response.payload.stage === "downloading"
                ? `Downloading the model failed: ${response.payload.reason}`
                : `The model did not pass its quality check: ${response.payload.reason}`,
          });
          client.send(buildRpcMessage("ollama.status", {}));
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

  const embeddingModels = models.filter(({ family }) => family === "embedding");
  const activeModel = embeddingModels.find(({ isActive }) => isActive);
  const isConnected = server !== "loading" && server !== "notConnected";

  // While a step is not done, look again: starting Ollama shows up by itself.
  const isWaiting = server === "unreachable" || server === "refused";

  useEffect(() => {
    if (!isWaiting) {
      return undefined;
    }

    const timer = setInterval(refresh, recheckIntervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [isWaiting, recheckIntervalMs, refresh]);

  const setUp = () => {
    requestAccess().then(refresh, () => undefined);
  };

  const turnOn = () => {
    if (RECOMMENDED === undefined) {
      return;
    }

    setEnabling({ stage: "downloading", percent: undefined });
    client.send(buildRpcMessage("ollama.enable", { name: RECOMMENDED.name }));
  };

  const isPresent = server === "refused" || server === "running";
  const allow = buildOllamaOriginsCommand(platform, extensionOrigin);
  const recommendedEntry = embeddingModels.find(
    ({ name }) => name.split(":")[0] === RECOMMENDED?.name,
  );

  return (
    <details
      data-testid="ollama-card"
      data-state={server}
      open={isOpen}
      onToggle={(event) => {
        setIsOpen(event.currentTarget.open);
      }}
      className="mt-6 rounded border border-slate-200 p-4 dark:border-slate-700"
    >
      <summary className="cursor-pointer text-sm font-medium">
        Faster local AI with Ollama <span className="font-normal">(optional)</span>
      </summary>

      <div className="mt-2 flex flex-col gap-3 text-sm">
        <p>
          Ollama is a free app that runs AI models on this computer. With it, finding similar pages
          is faster, and page summaries become possible. Nothing leaves your computer. You
          don&apos;t need it: the extension works without it.
        </p>

        {server === "notConnected" && (
          <div>
            <Button data-testid="ollama-connect" onClick={setUp}>
              Set up Ollama
            </Button>
          </div>
        )}

        {isConnected && activeModel !== undefined && (
          <p data-testid="ollama-on" className="flex items-center gap-2 font-medium">
            <StatusDot tone="ok" />
            Local AI is on, using {activeModel.name}.
          </p>
        )}

        {isConnected && activeModel === undefined && (
          <ol data-testid="ollama-checklist" className="flex flex-col gap-3">
            <Step
              number={1}
              title="Install Ollama"
              status={isPresent ? "done" : "current"}
              testId="ollama-step-install"
            >
              <span>
                <a
                  href={OLLAMA_DOWNLOAD_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Download Ollama
                </a>{" "}
                (free) and install it like any other app. Skip this if you already have it.
              </span>
            </Step>
            <Step
              number={2}
              title="Open Ollama"
              status={isPresent ? "done" : "current"}
              testId="ollama-step-open"
            >
              <span data-testid="ollama-unreachable">
                Open it like any other app. A llama icon appears in the menu bar (on Windows, by the
                clock). This page notices by itself within a few seconds.
              </span>
            </Step>
            {server === "refused" && (
              <Step
                number={3}
                title="Allow this extension"
                status="current"
                testId="ollama-step-allow"
              >
                <span data-testid="ollama-refused">
                  Ollama is open, but it only answers apps it trusts. Let it trust this extension —
                  you only do this once.
                </span>
                <span>{allow.where}</span>
                <Command text={allow.command} testId="ollama-allow-command" />
                {allow.afterward !== undefined && <span>{allow.afterward}</span>}
              </Step>
            )}
            <Step
              number={server === "refused" ? 4 : 3}
              title="Turn on local AI"
              status={server === "running" ? "current" : "pending"}
              testId="ollama-step-turn-on"
            >
              {server === "running" && (
                <div className="flex flex-col items-start gap-1">
                  {enabling === undefined || enabling.stage === "failed" ? (
                    <Button data-testid="ollama-turn-on" onClick={turnOn}>
                      Turn on local AI
                    </Button>
                  ) : (
                    <span data-testid="ollama-enable-progress" className="flex items-center gap-2">
                      <StatusDot tone="busy" />
                      {enabling.stage === "downloading"
                        ? `Downloading the model${enabling.percent === undefined ? "…" : ` ${enabling.percent}%`}`
                        : "Checking the model's quality…"}
                    </span>
                  )}
                  {recommendedEntry === undefined && RECOMMENDED !== undefined && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Downloads {RECOMMENDED.name} ({RECOMMENDED.approximateSize}) through Ollama.
                    </span>
                  )}
                  {enabling?.stage === "failed" && (
                    <span className="flex items-start gap-2 text-red-700 dark:text-red-400">
                      <span className="mt-1.5">
                        <StatusDot tone="bad" />
                      </span>
                      <span data-testid="ollama-enable-failure" role="alert">
                        {enabling.reason}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </Step>
          </ol>
        )}

        {isWaiting && (
          <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <StatusDot tone="busy" />
            Checking again every few seconds.
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

        {isConnected && (
          <details data-testid="ollama-more">
            <summary className="cursor-pointer text-xs">More: models and commands</summary>
            <div className="mt-2 flex flex-col gap-2 text-xs">
              <span>
                Start Ollama without the app (Linux):{" "}
                <Command text="ollama serve" testId="ollama-serve-command" />
              </span>
              {server === "running" && (
                <ul data-testid="ollama-models" className="flex flex-col gap-2">
                  {embeddingModels.length === 0 && <li>Ollama has no embedding model yet.</li>}
                  {embeddingModels.map((model) => {
                    const step = activity[model.name];

                    return (
                      <li key={model.name} data-testid="ollama-model" data-model={model.name}>
                        <span className="font-medium">{model.name}</span>{" "}
                        <span className="text-slate-500 dark:text-slate-400">
                          {model.size}
                          {model.isRecommended && " · recommended"}
                        </span>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {model.isActive && (
                            <>
                              <span
                                data-testid="ollama-active"
                                className="flex items-center gap-1.5"
                              >
                                <StatusDot tone="ok" />
                                Active
                              </span>
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
                                <Command
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
                                client.send(
                                  buildRpcMessage("ollama.register", { name: model.name }),
                                );
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
            </div>
          </details>
        )}
      </div>
    </details>
  );
}
