import type { OllamaOriginsCommand } from "@/features/ollama";
import { OLLAMA_DOWNLOAD_URL } from "@/shared/config";
import { Button, CopyableCommand, StatusDot } from "@/shared/ui";

import type { TurnOnPlan } from "../../model/buildTurnOnPlan";
import type { SetupStep } from "../../model/getSetupStep/types";
import type { TurnOnProgress } from "../../types";
import { formatDownloadSize } from "./utils/formatDownloadSize";

/** Why "Turn on AI" stopped, as the background said. */
export interface TurnOnFailure {
  name?: string;
  stage: "downloading" | "checking";
  reason: string;
}

export interface SetupWizardProps {
  step: SetupStep;
  /** What "Turn on AI" will download; known once Ollama answers. */
  plan: TurnOnPlan | undefined;
  progress: TurnOnProgress | undefined;
  failure: TurnOnFailure | undefined;
  /** Names of the models on, for the last step. */
  activeModels: readonly string[];
  /** The one command that lets Ollama trust this extension, for this computer. */
  allowCommand: OllamaOriginsCommand;
  onTurnOn: () => void;
  onCheckNow: () => void;
}

/** Where each step sits in the three the user sees. */
const STEP_NUMBERS: Record<SetupStep, number> = {
  checking: 1,
  getOllama: 1,
  allowExtension: 1,
  turnOn: 2,
  turningOn: 2,
  done: 3,
};

/** The quiet line under a step that waits for something the user does elsewhere. */
function Waiting({ onCheckNow }: { onCheckNow: () => void }) {
  return (
    <p className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <StatusDot tone="busy" />
      This page notices by itself within a few seconds.
      <button type="button" className="underline" onClick={onCheckNow}>
        Check now
      </button>
    </p>
  );
}

const describeProgress = (progress: TurnOnProgress): string => {
  const what = progress.family === "embedding" ? "similar pages" : "summaries";

  return progress.stage === "downloading"
    ? `Downloading the model for ${what} (${progress.name})…`
    : `Checking the model for ${what} (${progress.name})…`;
};

const describeFailure = (failure: TurnOnFailure): string =>
  failure.name === undefined
    ? failure.reason
    : `${failure.stage === "downloading" ? "Downloading" : "Checking"} ${failure.name} failed: ${failure.reason}`;

/**
 * The setup page: one step at a time, in plain words, moving on by itself as
 * the extension sees each one done.
 */
export function SetupWizard({
  step,
  plan,
  progress,
  failure,
  activeModels,
  allowCommand,
  onTurnOn,
  onCheckNow,
}: SetupWizardProps) {
  const percent = progress === undefined ? 0 : Math.round(progress.fraction * 100);

  return (
    <section
      data-testid="setup-step"
      data-step={step}
      aria-live="polite"
      className="rounded-lg border border-slate-200 p-6 dark:border-slate-700"
    >
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
        Step {STEP_NUMBERS[step]} of 3
      </p>

      {step === "checking" && (
        <p className="mt-2 flex items-center gap-2">
          <StatusDot tone="busy" />
          Looking for Ollama…
        </p>
      )}

      {step === "getOllama" && (
        <>
          <h2 className="mt-2 text-lg font-semibold">Get Ollama</h2>
          <p className="mt-2 text-sm">
            Ollama is a free app that runs AI models on this computer. Install it like any other
            app.
          </p>
          <p className="mt-4">
            <a
              data-testid="setup-download"
              href={OLLAMA_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              Download Ollama
            </a>
          </p>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            Already have it? Just open it — a llama icon appears in the menu bar (on Windows, by the
            clock).
          </p>
          <Waiting onCheckNow={onCheckNow} />
        </>
      )}

      {step === "allowExtension" && (
        <>
          <h2 className="mt-2 text-lg font-semibold">Let Ollama trust this extension</h2>
          <p className="mt-2 text-sm">
            Ollama is open, but it only answers apps it trusts. You do this once.
          </p>
          <p className="mt-4 text-sm">{allowCommand.where}</p>
          <div className="mt-2">
            <CopyableCommand text={allowCommand.command} testId="setup-allow-command" />
          </div>
          {allowCommand.afterward !== undefined && (
            <p className="mt-2 text-sm">{allowCommand.afterward}</p>
          )}
          <Waiting onCheckNow={onCheckNow} />
        </>
      )}

      {step === "turnOn" && (
        <>
          <h2 className="mt-2 text-lg font-semibold">Turn on AI</h2>
          <p className="mt-2 text-sm">
            Two models: one finds similar pages, the other writes summaries. Everything runs on this
            computer; nothing leaves it.
          </p>
          <p data-testid="setup-size" className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {plan === undefined || plan.downloadBytes === 0
              ? "Ollama already has what it needs: nothing to download."
              : `Downloads about ${formatDownloadSize(plan.downloadBytes)}, once.`}
          </p>
          {failure !== undefined && (
            <p
              data-testid="setup-failure"
              role="alert"
              className="mt-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-400"
            >
              <span className="mt-1.5">
                <StatusDot tone="bad" />
              </span>
              {describeFailure(failure)}
            </p>
          )}
          <div className="mt-4">
            <Button data-testid="setup-turn-on" onClick={onTurnOn}>
              {failure === undefined ? "Turn on AI" : "Try again"}
            </Button>
          </div>
        </>
      )}

      {step === "turningOn" && (
        <>
          <h2 className="mt-2 text-lg font-semibold">Turning on AI</h2>
          <div
            role="progressbar"
            aria-label="Turning on AI"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="mt-4 h-2 overflow-hidden rounded bg-slate-200 dark:bg-slate-700"
          >
            <div className="h-full bg-sky-500" style={{ width: `${percent}%` }} />
          </div>
          <p data-testid="setup-progress" className="mt-2 text-sm">
            {progress === undefined ? "Starting…" : `${describeProgress(progress)} ${percent}%`}
          </p>
          {progress?.isEmbeddingReady === true && (
            <p data-testid="setup-embedding-ready" className="mt-2 flex items-center gap-2 text-sm">
              <StatusDot tone="ok" />
              Similar pages already work. Summaries are still being prepared.
            </p>
          )}
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            You can close this tab: it keeps going.
          </p>
        </>
      )}

      {step === "done" && (
        <>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-semibold">
            <StatusDot tone="ok" />
            AI is on
          </h2>
          {activeModels.length > 0 && (
            <p data-testid="setup-active-models" className="mt-2 text-sm">
              Using {activeModels.join(" and ")}.
            </p>
          )}
          <p className="mt-2 text-sm">
            You can close this tab and start researching from the toolbar button.
          </p>
        </>
      )}
    </section>
  );
}
