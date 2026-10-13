import { useEffect, useRef, useState } from "react";

import {
  buildRpcMessage,
  parseRpcMessage,
  type RpcMessage,
  RpcMessageError,
  rpcResponseSchemas,
} from "@/shared/rpc";
import { Button, StatusDot, type StatusTone } from "@/shared/ui";

import { LIFETIME_STRATEGIES, PROBE_HEARTBEAT_INTERVAL_MS } from "../../constants";
import { diagnosticsResponseSchemas } from "../../schemas";
import type { LifetimeStrategy, ProbeOutcome } from "../../types";

/** The options page's connection to the background, shared with the rest of the page. */
export interface LifetimeProbeCardClient {
  send: (message: RpcMessage<string, unknown>) => void;
  subscribe: (listener: (message: unknown) => void) => () => void;
}

export interface LifetimeProbeCardProps {
  client: LifetimeProbeCardClient;
  /** How often to read the runs again while one is still running. */
  refreshIntervalMs?: number;
}

const responseSchemas = { ...diagnosticsResponseSchemas, ...rpcResponseSchemas } as const;

const STRATEGY_LABELS: Record<LifetimeStrategy, string> = {
  none: "None (control)",
  apiActivity: "API activity",
  wakeAndResume: "Wake and resume",
  hostPage: "Host page",
  jobRunner: "Job runner (chosen)",
};

const STATE_TONES: Record<ProbeOutcome["state"], StatusTone> = {
  running: "busy",
  completed: "ok",
  resumed: "attention",
  stopped: "bad",
};

/** Writes milliseconds as seconds to one decimal place. */
const formatSeconds = (ms: number): string => `${Math.round(ms / 100) / 10} s`;

/** Says how a run went in one line. */
const describeRun = (run: ProbeOutcome): string => {
  const gap = `longest gap ${formatSeconds(run.longestGapMs)}`;

  switch (run.state) {
    case "running": {
      return `running, ${formatSeconds(run.lastSeenMs)} of ${formatSeconds(run.holdMs)}`;
    }
    case "completed": {
      return `held ${formatSeconds(run.holdMs)} without an unload, ${gap}`;
    }
    case "resumed": {
      return `finished after ${run.pageLoads - 1} unload(s), ${gap}`;
    }
    case "stopped": {
      const loads = run.pageLoads > 1 ? ` (resumed ${run.pageLoads - 1} time(s) so far)` : "";

      return `unloaded at ${formatSeconds(run.lastSeenMs)} of ${formatSeconds(run.holdMs)}${loads}`;
    }
  }
};

/**
 * Developer tool for spike M0-1: starts a background-lifetime probe run and
 * lists how earlier runs went. A run is read from heartbeats the background
 * wrote, so its outcome is there after this page was closed and reopened —
 * which a fair run needs, since an open page keeps the background company.
 */
export function LifetimeProbeCard({
  client,
  refreshIntervalMs = PROBE_HEARTBEAT_INTERVAL_MS,
}: LifetimeProbeCardProps) {
  const [runs, setRuns] = useState<readonly ProbeOutcome[]>([]);
  const [hasRead, setHasRead] = useState(false);
  // A started run is listed only once it has written its first beat.
  const [awaitedRunId, setAwaitedRunId] = useState<string>();
  const [strategy, setStrategy] = useState<LifetimeStrategy>("jobRunner");
  const [holdSeconds, setHoldSeconds] = useState(120);
  const [problem, setProblem] = useState<string>();
  // A refusal names no request, so it is this card's only while a start waits.
  const isStarting = useRef(false);

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

      if (response.type === "diagnostics.probes") {
        setRuns(response.payload.runs);
        setHasRead(true);
      } else if (response.type === "diagnostics.probeStarted") {
        isStarting.current = false;
        setProblem(undefined);
        setAwaitedRunId(response.payload.runId);
        client.send(buildRpcMessage("diagnostics.readProbes", {}));
      } else if (
        (response.type === "rpc.refused" && isStarting.current) ||
        (response.type === "rpc.failed" && response.payload.requestType.startsWith("diagnostics."))
      ) {
        isStarting.current = false;
        setProblem(response.payload.reason);
      }
    });

    client.send(buildRpcMessage("diagnostics.readProbes", {}));

    return unsubscribe;
  }, [client]);

  const isRunning =
    runs.some(({ state }) => state === "running") ||
    (awaitedRunId !== undefined && !runs.some(({ runId }) => runId === awaitedRunId));

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    const timer = setInterval(() => {
      client.send(buildRpcMessage("diagnostics.readProbes", {}));
    }, refreshIntervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [client, isRunning, refreshIntervalMs]);

  const start = () => {
    isStarting.current = true;
    client.send(
      buildRpcMessage("diagnostics.lifetimeProbe", { strategy, holdMs: holdSeconds * 1000 }),
    );
  };

  return (
    <div data-testid="lifetime-probe" data-read={hasRead} className="flex flex-col gap-2 text-sm">
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Holds the background busy and records when it was unloaded. Close every extension page after
        starting, or the open page keeps the background alive.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          Strategy
          <select
            data-testid="probe-strategy"
            value={strategy}
            onChange={(event) => setStrategy(event.target.value as LifetimeStrategy)}
            className="rounded border border-slate-300 bg-transparent px-1 dark:border-slate-600"
          >
            {LIFETIME_STRATEGIES.map((option) => (
              <option key={option} value={option}>
                {STRATEGY_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          Hold (s)
          <input
            data-testid="probe-hold"
            type="number"
            min={1}
            max={600}
            value={holdSeconds}
            onChange={(event) => setHoldSeconds(Number(event.target.value))}
            className="w-20 rounded border border-slate-300 bg-transparent px-1 dark:border-slate-600"
          />
        </label>
        <Button data-testid="probe-start" onClick={start}>
          Start
        </Button>
      </div>
      {problem !== undefined && (
        <p data-testid="probe-problem" className="text-red-700 dark:text-red-400">
          {problem}
        </p>
      )}
      {runs.length === 0 ? (
        <p data-testid="probe-none" className="text-xs">
          No runs yet.
        </p>
      ) : (
        <ul data-testid="probe-runs" className="flex flex-col gap-1 text-xs">
          {runs.map((run) => (
            <li
              key={run.runId}
              data-testid="probe-run"
              data-run-id={run.runId}
              data-strategy={run.strategy}
              data-state={run.state}
              className="flex items-center gap-2"
            >
              <StatusDot tone={STATE_TONES[run.state]} />
              <span>
                {STRATEGY_LABELS[run.strategy as LifetimeStrategy] ?? run.strategy}:{" "}
                {describeRun(run)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
