import { useCallback, useEffect, useState } from "react";

import { clusterSummaryResponseSchemas, type SummariesView } from "@/features/clusterSummaries";
import { ClusterSummaries } from "@/features/clusterSummaries/ui/clusterSummaries";
import {
  buildComparisonCsv,
  type ComparisonTable as Table,
  comparisonTableResponseSchemas,
} from "@/features/comparisonTable";
import { ComparisonTable } from "@/features/comparisonTable/ui/comparisonTable";
import { useDataChanges, type WatchData } from "@/features/liveData/ui/useDataChanges";
import { factRejectionResponseSchemas } from "@/features/factRejections";
import { type OpenQuestionsView, openQuestionResponseSchemas } from "@/features/openQuestions";
import { SuggestedQuestions } from "@/features/openQuestions/ui/suggestedQuestions";
import { type ResearchGaps as Gaps, researchGapResponseSchemas } from "@/features/researchGaps";
import { ResearchGaps } from "@/features/researchGaps/ui/researchGaps";
import { getErrorMessage } from "@/shared/getErrorMessage";
import {
  buildRpcMessage,
  parseRpcMessage,
  type RpcMessage,
  rpcResponseSchemas,
} from "@/shared/rpc";

/** The page's end of its conversation with the background: requests, and being told of changes. */
export interface SummariesClient {
  request: (message: RpcMessage<string, unknown>) => Promise<unknown>;
  /** How the page hears that data changed. Without it the page shows what it read when it opened. */
  watch?: WatchData;
}

/** The kinds of data this page shows, so it reads again only when one of them changes. */
const WATCHED_TOPICS = ["pages", "facts", "clusters", "summaries", "questions", "models"] as const;

export interface SummariesAppProps {
  client: SummariesClient;
  /** Saves a text file for the user; a Blob download from this page by default. */
  saveFile?: (name: string, text: string) => void;
}

const responseSchemas = {
  ...clusterSummaryResponseSchemas,
  ...comparisonTableResponseSchemas,
  ...researchGapResponseSchemas,
  ...factRejectionResponseSchemas,
  ...openQuestionResponseSchemas,
  ...rpcResponseSchemas,
} as const;

/**
 * Downloads a CSV through a Blob link on this extension page (REQ-SYN-007),
 * which needs no `downloads` permission.
 */
const downloadCsv = (name: string, text: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");

  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

type SummariesState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; view: SummariesView };

/** Composition root of the Summaries page. */
export function SummariesApp({ client, saveFile = downloadCsv }: SummariesAppProps) {
  const [state, setState] = useState<SummariesState>({ status: "loading" });
  const [table, setTable] = useState<Table>();
  const [entityType, setEntityType] = useState<string>();
  const [gaps, setGaps] = useState<Gaps>();
  const [questions, setQuestions] = useState<OpenQuestionsView>();
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

  const loadQuestions = useCallback(async () => {
    const answer = await ask(buildRpcMessage("questions.read", {}));

    if (answer?.type === "questions.view") {
      setQuestions(answer.payload.view ?? undefined);
    }
  }, [ask]);

  const load = useCallback(async () => {
    await loadQuestions();

    const answer = await ask(buildRpcMessage("summaries.read", {}));

    if (answer?.type === "summaries.view") {
      setState(
        answer.payload.session === null
          ? { status: "empty" }
          : { status: "ready", view: answer.payload.session },
      );
    }
  }, [ask, loadQuestions]);

  useEffect(() => {
    let isCurrent = true;

    client.request(buildRpcMessage("questions.read", {})).then(
      (answer) => {
        try {
          const response = parseRpcMessage(answer, responseSchemas);

          if (isCurrent && response.type === "questions.view") {
            setQuestions(response.payload.view ?? undefined);
          }
        } catch (error) {
          if (isCurrent) {
            setFailure(getErrorMessage(error));
          }
        }
      },
      (error: unknown) => {
        if (isCurrent) {
          setFailure(getErrorMessage(error));
        }
      },
    );
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

  const loadTable = useCallback(
    async (type?: string) => {
      const answer = await ask(
        buildRpcMessage("table.read", type === undefined ? {} : { entityType: type }),
      );

      if (answer?.type === "table.view") {
        setTable(answer.payload.table ?? undefined);
      }

      // Gaps follow the table the page shows: its type and its columns.
      const gapsAnswer = await ask(
        buildRpcMessage("gaps.read", type === undefined ? {} : { entityType: type }),
      );

      if (gapsAnswer?.type === "gaps.view") {
        setGaps(gapsAnswer.payload.gaps ?? undefined);
      }
    },
    [ask],
  );

  useEffect(() => {
    let isCurrent = true;

    client.request(buildRpcMessage("gaps.read", {})).then(
      (answer) => {
        try {
          const response = parseRpcMessage(answer, responseSchemas);

          if (isCurrent && response.type === "gaps.view") {
            setGaps(response.payload.gaps ?? undefined);
          }
        } catch (error) {
          if (isCurrent) {
            setFailure(getErrorMessage(error));
          }
        }
      },
      (error: unknown) => {
        if (isCurrent) {
          setFailure(getErrorMessage(error));
        }
      },
    );
    client.request(buildRpcMessage("table.read", {})).then(
      (answer) => {
        try {
          const response = parseRpcMessage(answer, responseSchemas);

          if (isCurrent && response.type === "table.view") {
            setTable(response.payload.table ?? undefined);
          }
        } catch (error) {
          if (isCurrent) {
            setFailure(getErrorMessage(error));
          }
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

  const chooseType = useCallback(
    async (type: string) => {
      setEntityType(type);
      await loadTable(type);
    },
    [loadTable],
  );

  const setColumns = useCallback(
    async (type: string, columns: string[]) => {
      await ask(buildRpcMessage("table.setColumns", { entityType: type, columns }));
      await loadTable(entityType ?? type);
    },
    [ask, entityType, loadTable],
  );

  const exportTable = useCallback(() => {
    if (table === undefined || state.status !== "ready") {
      return;
    }

    saveFile(`${state.view.title} — ${table.entityType ?? "table"}.csv`, buildComparisonCsv(table));
  }, [saveFile, state, table]);

  /** A rejection or a restore changes summaries, the table and the gaps alike. */
  const reloadAll = useCallback(async () => {
    await load();
    await loadTable(entityType);
  }, [entityType, load, loadTable]);

  useDataChanges(client.watch, WATCHED_TOPICS, reloadAll);

  const reject = useCallback(
    async (factIds: string[]) => {
      await ask(buildRpcMessage("facts.reject", { factIds }));
      await reloadAll();
    },
    [ask, reloadAll],
  );

  const restore = useCallback(async () => {
    await ask(buildRpcMessage("facts.restoreRejections", {}));
    await reloadAll();
  }, [ask, reloadAll]);

  const suggestQuestions = useCallback(async () => {
    await ask(buildRpcMessage("questions.refresh", {}));
    await loadQuestions();
  }, [ask, loadQuestions]);

  const searchGap = useCallback(
    async (query: string) => {
      await ask(buildRpcMessage("gaps.search", { query }));
    },
    [ask],
  );

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
          onReject={(factIds) => void reject(factIds)}
        />
      )}
      {state.status === "ready" && table !== undefined && (
        <ComparisonTable
          table={table}
          onChooseType={(type) => void chooseType(type)}
          onSetColumns={(type, columns) => void setColumns(type, columns)}
          onExport={exportTable}
          onReject={(factIds) => void reject(factIds)}
          onRestore={() => void restore()}
        />
      )}
      {state.status === "ready" && gaps !== undefined && (
        <ResearchGaps gaps={gaps} onSearch={(query) => void searchGap(query)} />
      )}
      {state.status === "ready" && questions !== undefined && (
        <SuggestedQuestions
          view={questions}
          onSearch={(query) => void searchGap(query)}
          onSuggest={() => void suggestQuestions()}
        />
      )}
    </main>
  );
}
