import { useCallback, useEffect, useState } from "react";

import { clusterSummaryResponseSchemas, type SummariesView } from "@/features/clusterSummaries";
import { ClusterSummaries } from "@/features/clusterSummaries/ui/clusterSummaries";
import { getErrorMessage } from "@/shared/getErrorMessage";
import {
  buildRpcMessage,
  parseRpcMessage,
  type RpcMessage,
  rpcResponseSchemas,
} from "@/shared/rpc";

/** The page's end of its conversation with the background: one-shot requests. */
export interface SummariesClient {
  request: (message: RpcMessage<string, unknown>) => Promise<unknown>;
}

export interface SummariesAppProps {
  client: SummariesClient;
  /** How often to read again while a summary asked for is being written. */
  refreshIntervalMs?: number;
}

const responseSchemas = { ...clusterSummaryResponseSchemas, ...rpcResponseSchemas } as const;

type SummariesState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; view: SummariesView };

/** Composition root of the Summaries page. */
export function SummariesApp({ client, refreshIntervalMs = 3_000 }: SummariesAppProps) {
  const [state, setState] = useState<SummariesState>({ status: "loading" });
  const [failure, setFailure] = useState<string>();

  /** Sends a request and returns its answer, or records why it failed. */
  const ask = useCallback(
    async (message: RpcMessage<string, unknown>) => {
      try {
        const answer = parseRpcMessage(await client.request(message), responseSchemas);

        if (answer.type === "rpc.refused" || answer.type === "rpc.failed") {
          setFailure(answer.payload.reason);
          return undefined;
        }

        return answer;
      } catch (error) {
        setFailure(getErrorMessage(error));
        return undefined;
      }
    },
    [client],
  );

  const load = useCallback(async () => {
    const answer = await ask(buildRpcMessage("summaries.read", {}));

    if (answer?.type === "summaries.view") {
      setState(
        answer.payload.session === null
          ? { status: "empty" }
          : { status: "ready", view: answer.payload.session },
      );
    }
  }, [ask]);

  useEffect(() => {
    let isCurrent = true;

    client.request(buildRpcMessage("summaries.read", {})).then(
      (answer) => {
        if (!isCurrent) {
          return;
        }

        try {
          const response = parseRpcMessage(answer, responseSchemas);

          if (response.type === "summaries.view") {
            setState(
              response.payload.session === null
                ? { status: "empty" }
                : { status: "ready", view: response.payload.session },
            );
          } else if (response.type === "rpc.refused" || response.type === "rpc.failed") {
            setFailure(response.payload.reason);
          }
        } catch (error) {
          setFailure(getErrorMessage(error));
        }
      },
      (error: unknown) => {
        if (isCurrent) {
          setFailure(getErrorMessage(error));
        }
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [client]);

  const isPending =
    state.status === "ready" && state.view.clusters.some(({ isPending: pending }) => pending);

  // A summary asked for is written in the background: read again until it is.
  useEffect(() => {
    if (!isPending) {
      return undefined;
    }

    const timer = setInterval(() => {
      void load();
    }, refreshIntervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [isPending, load, refreshIntervalMs]);

  const summarize = useCallback(
    async (clusterId: string) => {
      await ask(buildRpcMessage("summaries.refresh", { clusterId }));
      await load();
    },
    [ask, load],
  );

  return (
    <main className="min-h-screen bg-white p-4 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {failure !== undefined && (
        <p
          data-testid="summaries-error"
          role="alert"
          className="mb-2 text-sm text-red-700 dark:text-red-400"
        >
          {failure}
        </p>
      )}
      {state.status === "loading" && <p className="text-sm">Loading…</p>}
      {state.status === "empty" && (
        <p data-testid="summaries-empty" className="text-sm">
          No research session is recorded.
        </p>
      )}
      {state.status === "ready" && (
        <ClusterSummaries
          title={state.view.title}
          clusters={state.view.clusters}
          canSummarize={state.view.canSummarize}
          onSummarize={(clusterId) => void summarize(clusterId)}
        />
      )}
    </main>
  );
}
