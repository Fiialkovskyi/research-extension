import { useEffect, useState } from "react";

import {
  aiSetupResponseSchemas,
  type AiSetupStatus,
  buildTurnOnPlan,
  getSetupStep,
  type SetupServerState,
  type TurnOnProgress,
} from "@/features/aiSetup";
import { SetupWizard, type TurnOnFailure } from "@/features/aiSetup/ui/setupWizard";
import { liveDataResponseSchemas } from "@/features/liveData";
import {
  buildOllamaOriginsCommand,
  ollamaResponseSchemas,
  type OllamaModelEntry,
  type OllamaPlatform,
} from "@/features/ollama";
import {
  buildRpcMessage,
  parseRpcMessage,
  type RpcMessage,
  RpcMessageError,
  rpcResponseSchemas,
} from "@/shared/rpc";

/** The setup page's end of its connection to the background. */
export interface SetupClient {
  send: (message: RpcMessage<string, unknown>) => void;
  /** Registers a listener and returns the function that removes it. */
  subscribe: (listener: (message: unknown) => void) => () => void;
}

export interface SetupAppProps {
  client: SetupClient;
  /**
   * This installation's origin and operating system, which the command that
   * lets Ollama trust the extension is written for.
   */
  environment: { extensionOrigin: string; platform: OllamaPlatform };
  /** How often to look at Ollama again while waiting for the user. */
  recheckIntervalMs?: number;
}

const responseSchemas = {
  ...aiSetupResponseSchemas,
  ...liveDataResponseSchemas,
  ...ollamaResponseSchemas,
  ...rpcResponseSchemas,
} as const;

/** Steps that wait for something the user does outside this page. */
const WAITING_STEPS = new Set(["checking", "getOllama", "allowExtension"]);

/** Composition root of the setup page: from no Ollama to AI on, one step at a time. */
export function SetupApp({ client, environment, recheckIntervalMs = 3_000 }: SetupAppProps) {
  const [server, setServer] = useState<SetupServerState>("loading");
  const [models, setModels] = useState<OllamaModelEntry[]>([]);
  const [status, setStatus] = useState<AiSetupStatus | undefined>();
  const [isTurningOn, setIsTurningOn] = useState(false);
  const [progress, setProgress] = useState<TurnOnProgress | undefined>();
  const [failure, setFailure] = useState<TurnOnFailure | undefined>();

  useEffect(() => {
    const unsubscribe = client.subscribe((message) => {
      let response;

      try {
        response = parseRpcMessage(message, responseSchemas);
      } catch (error) {
        // An answer meant for another page on the same port is not ours to render.
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
        case "aiSetup.status":
          setStatus(response.payload);
          break;
        case "aiSetup.turnedOn":
          setStatus(response.payload);
          setIsTurningOn(false);
          setProgress(undefined);
          break;
        case "aiSetup.turnOnState":
          setIsTurningOn(response.payload.isRunning);
          setProgress(response.payload.progress);
          break;
        case "aiSetup.turnOnProgress":
          setIsTurningOn(true);
          setProgress(response.payload);
          break;
        case "aiSetup.turnOnFailed":
          setIsTurningOn(false);
          setProgress(undefined);
          setFailure(response.payload);
          client.send(buildRpcMessage("ollama.status", {}));
          break;
        case "data.changed":
          if (response.payload.topics.some((topic) => topic === "models" || topic === "access")) {
            client.send(buildRpcMessage("aiSetup.read", {}));
            client.send(buildRpcMessage("ollama.status", {}));
          }

          break;
        default:
          break;
      }
    });

    client.send(buildRpcMessage("data.subscribe", {}));
    // Opening this page is the user starting setup: from now on Ollama may be asked.
    client.send(buildRpcMessage("aiSetup.start", {}));
    // A run started earlier, from a page since closed, is followed from here.
    client.send(buildRpcMessage("aiSetup.watch", {}));
    client.send(buildRpcMessage("ollama.status", {}));

    return unsubscribe;
  }, [client]);

  const step = getSetupStep({ server, isSetUp: status?.isSetUp ?? false, isTurningOn });

  // While waiting for the user to install, open or allow Ollama, look again.
  useEffect(() => {
    if (!WAITING_STEPS.has(step)) {
      return undefined;
    }

    const timer = setInterval(() => {
      client.send(buildRpcMessage("ollama.status", {}));
    }, recheckIntervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [client, step, recheckIntervalMs]);

  const turnOn = () => {
    setFailure(undefined);
    setIsTurningOn(true);
    client.send(buildRpcMessage("aiSetup.turnOn", {}));
  };

  return (
    <main
      data-testid="setup-app"
      className="min-h-screen bg-white px-6 py-10 text-slate-900 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="mx-auto max-w-lg">
        <h1 className="text-xl font-semibold">Set up local AI</h1>
        <p className="mt-1 mb-6 text-sm text-slate-600 dark:text-slate-300">
          Research Graph uses AI that runs on this computer to find similar pages and write
          summaries. Nothing you read leaves it.
        </p>
        <SetupWizard
          step={step}
          plan={server === "running" ? buildTurnOnPlan(models) : undefined}
          progress={progress}
          failure={failure}
          activeModels={models.filter(({ isActive }) => isActive).map(({ name }) => name)}
          allowCommand={buildOllamaOriginsCommand(
            environment.platform,
            environment.extensionOrigin,
          )}
          onTurnOn={turnOn}
          onCheckNow={() => {
            client.send(buildRpcMessage("ollama.status", {}));
          }}
        />
      </div>
    </main>
  );
}
