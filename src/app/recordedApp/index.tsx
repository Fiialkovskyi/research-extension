import { useCallback, useEffect, useState } from "react";

import { factExtractionResponseSchemas } from "@/features/factExtraction";
import { type RecordedSession, recordedDataResponseSchemas } from "@/features/recordedData";
import { RecordedPage } from "@/features/recordedData/ui/recordedPage";
import { getErrorMessage } from "@/shared/getErrorMessage";
import {
  buildRpcMessage,
  parseRpcMessage,
  type RpcMessage,
  rpcResponseSchemas,
} from "@/shared/rpc";

/** The page's end of its conversation with the background: one-shot requests. */
export interface RecordedClient {
  request: (message: RpcMessage<string, unknown>) => Promise<unknown>;
}

export interface RecordedAppProps {
  client: RecordedClient;
  /** How often to read again while facts are being extracted. */
  refreshIntervalMs?: number;
}

const responseSchemas = {
  ...recordedDataResponseSchemas,
  ...factExtractionResponseSchemas,
  ...rpcResponseSchemas,
} as const;

/** Whether some page's facts are still being extracted, or were asked for and not begun. */
const isExtracting = (session: RecordedSession, isRequested: boolean): boolean =>
  session.pages.some(
    ({ snapshot, facts }) =>
      snapshot !== null && (facts === null ? isRequested : !facts.isFinished),
  );

/** What the page shows: nothing yet, nothing to show, or a session. */
type RecordedState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; session: RecordedSession };

/** Turns the answer to `recorded.read` into what the page shows, or why it cannot. */
const readRecordedState = (answer: unknown): RecordedState | { failure: string } => {
  const response = parseRpcMessage(answer, responseSchemas);

  switch (response.type) {
    case "recorded.session":
      return response.payload.session === null
        ? { status: "empty" }
        : { status: "ready", session: response.payload.session };
    case "rpc.refused":
    case "rpc.failed":
      return { failure: response.payload.reason };
    default:
      return { failure: `The background answered "${response.type}".` };
  }
};

/** Composition root of the "What was recorded" page. */
export function RecordedApp({ client, refreshIntervalMs = 3_000 }: RecordedAppProps) {
  const [state, setState] = useState<RecordedState>({ status: "loading" });
  const [isExtractionRequested, setIsExtractionRequested] = useState(false);
  const [texts, setTexts] = useState<ReadonlyMap<string, string | null>>(new Map());
  const [failure, setFailure] = useState<string | undefined>();

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

  /** Reads again, after a deletion: the background owns what is recorded. */
  const load = useCallback(async () => {
    try {
      const next = readRecordedState(await client.request(buildRpcMessage("recorded.read", {})));

      if ("failure" in next) {
        setFailure(next.failure);
      } else {
        setState(next);
      }
    } catch (error) {
      setFailure(getErrorMessage(error));
    }
  }, [client]);

  useEffect(() => {
    let isCurrent = true;

    client.request(buildRpcMessage("recorded.read", {})).then(
      (answer) => {
        if (!isCurrent) {
          return;
        }

        const next = readRecordedState(answer);

        if ("failure" in next) {
          setFailure(next.failure);
        } else {
          setState(next);
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

  const showText = useCallback(
    async (nodeId: string) => {
      const answer = await ask(buildRpcMessage("recorded.readText", { nodeId }));

      if (answer?.type === "recorded.text") {
        setTexts((previous) => new Map(previous).set(nodeId, answer.payload.text));
      }
    },
    [ask],
  );

  const deleteNode = useCallback(
    async (nodeId: string) => {
      await ask(buildRpcMessage("node.delete", { nodeId }));
      await load();
    },
    [ask, load],
  );

  const extractFacts = useCallback(async () => {
    if ((await ask(buildRpcMessage("facts.extractNow", {}))) !== undefined) {
      setIsExtractionRequested(true);
      await load();
    }
  }, [ask, load]);

  const isRefreshing =
    state.status === "ready" && isExtracting(state.session, isExtractionRequested);

  // Counts change as pages are extracted; read again until none is under way.
  useEffect(() => {
    if (!isRefreshing) {
      return undefined;
    }

    const timer = setInterval(() => {
      void load();
    }, refreshIntervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [isRefreshing, load, refreshIntervalMs]);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      await ask(buildRpcMessage("session.delete", { sessionId }));
      setTexts(new Map());
      await load();
    },
    [ask, load],
  );

  return (
    <main className="min-h-screen bg-white p-4 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {failure !== undefined && (
        <p
          data-testid="recorded-error"
          role="alert"
          className="mb-2 text-sm text-red-700 dark:text-red-400"
        >
          {failure}
        </p>
      )}
      {state.status === "loading" && <p className="text-sm">Loading…</p>}
      {state.status === "empty" && (
        <p data-testid="recorded-empty" className="text-sm">
          No research session is recorded.
        </p>
      )}
      {state.status === "ready" && (
        <RecordedPage
          session={state.session}
          texts={texts}
          onShowText={(nodeId) => void showText(nodeId)}
          onDeleteNode={(nodeId) => void deleteNode(nodeId)}
          onDeleteSession={(sessionId) => void deleteSession(sessionId)}
          onExtractFacts={() => void extractFacts()}
          isExtracting={isRefreshing}
        />
      )}
    </main>
  );
}
