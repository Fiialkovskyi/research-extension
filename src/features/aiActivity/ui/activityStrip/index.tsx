import type { ActivityState } from "../../types";
import { StatusDot } from "@/shared/ui";

import { describeTotals } from "./utils/describeTotals";
import { formatElapsed } from "./utils/formatElapsed";
import { useNow } from "./utils/useNow";

export interface ActivityStripProps {
  state: ActivityState;
  /** Opens the setup page, offered while the local server is not answering. */
  onOpenSetup: () => void;
  /** Lets the work held until the user steps away run now, offered while it is waiting. */
  onRunNow: () => void;
  /** True while a run-now request is in flight, so it is not sent twice. */
  isRunNowPending?: boolean;
  /** The clock, for the elapsed time of a lone job. */
  getNow?: () => number;
}

/**
 * The popup's one line on what the local AI is doing. It is always in one
 * state and never hidden while AI is set up: silence would read as broken.
 *
 * A batch fills its bar by jobs settled; a lone job's share done is not known,
 * so its bar moves without filling and a timer shows it is alive.
 */
export function ActivityStrip({
  state,
  onOpenSetup,
  onRunNow,
  isRunNowPending = false,
  getNow = Date.now,
}: ActivityStripProps) {
  const isLone = state.kind === "working" && state.total === 1;
  const startedAt = state.kind === "working" ? state.startedAt : undefined;
  const now = useNow(isLone && startedAt !== undefined, getNow);
  const totals = state.kind === "ready" ? describeTotals(state.totals) : "";

  const failure =
    state.failed > 0 ? (
      <span data-testid="activity-failed" className="text-red-700 dark:text-red-400">
        {" · "}
        {state.failed} didn&apos;t finish
      </span>
    ) : null;

  return (
    <div
      data-testid="activity-strip"
      data-state={state.kind}
      role="status"
      aria-label="AI activity"
      className="mb-3 rounded border border-slate-200 p-2 text-sm dark:border-slate-700"
    >
      {state.kind === "working" && (
        <>
          <div className="flex items-center gap-2">
            <StatusDot tone="busy" />
            <span data-testid="activity-text">
              {state.label}
              {" · "}
              {isLone
                ? startedAt === undefined
                  ? "about to start"
                  : formatElapsed(now - startedAt)
                : `${state.settled} of ${state.total}`}
            </span>
            {failure}
          </div>
          {isLone ? (
            <div
              data-testid="activity-bar"
              role="progressbar"
              aria-label={state.label}
              className="mt-1.5 h-1 overflow-hidden rounded bg-slate-200 dark:bg-slate-700"
            >
              <div className="h-full w-2/5 animate-indeterminate rounded bg-sky-500 motion-reduce:animate-none" />
            </div>
          ) : (
            <div
              data-testid="activity-bar"
              role="progressbar"
              aria-label={state.label}
              aria-valuemin={0}
              aria-valuemax={state.total}
              aria-valuenow={state.settled}
              className="mt-1.5 h-1 overflow-hidden rounded bg-slate-200 dark:bg-slate-700"
            >
              <div
                className="h-full rounded bg-sky-500 transition-[width]"
                style={{ width: `${(state.settled / state.total) * 100}%` }}
              />
            </div>
          )}
        </>
      )}
      {state.kind === "waiting" && (
        <div className="flex items-center gap-2">
          <StatusDot tone="idle" />
          <span data-testid="activity-text">Runs when you step away · {state.waiting} waiting</span>
          {failure}
          <button
            type="button"
            data-testid="activity-run-now"
            className="ml-auto underline disabled:no-underline disabled:opacity-60"
            disabled={isRunNowPending}
            onClick={onRunNow}
          >
            Run now
          </button>
        </div>
      )}
      {state.kind === "paused" && (
        <div className="flex items-center gap-2">
          <StatusDot tone="attention" />
          <span data-testid="activity-text">
            Local AI isn&apos;t answering · {state.waiting} waiting
          </span>
          {failure}
          <button
            type="button"
            data-testid="activity-open-setup"
            className="ml-auto underline"
            onClick={onOpenSetup}
          >
            Open setup
          </button>
        </div>
      )}
      {state.kind === "ready" && (
        <>
          <div className="flex items-center gap-2">
            <StatusDot tone="ok" />
            <span data-testid="activity-text">AI ready · everything processed</span>
            {failure}
          </div>
          {totals !== "" && (
            <p data-testid="activity-totals" className="mt-1 text-slate-600 dark:text-slate-300">
              {totals}
            </p>
          )}
        </>
      )}
    </div>
  );
}
