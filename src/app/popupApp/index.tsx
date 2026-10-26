import { useCallback, useEffect, useState } from "react";

import { type ActivityState, aiActivityResponseSchemas } from "@/features/aiActivity";
import { ActivityStrip } from "@/features/aiActivity/ui/activityStrip";
import { aiSetupResponseSchemas, type AiSetupStatus } from "@/features/aiSetup";
import { SetupBanner } from "@/features/aiSetup/ui/setupBanner";
import { researchMapResponseSchemas } from "@/features/researchMap";
import {
  researchLibraryResponseSchemas,
  type SavedSessionSummary,
} from "@/features/researchLibrary";
import { formatLeftOff } from "@/features/researchLibrary/ui/formatLeftOff";
import { SessionPicker } from "@/features/researchLibrary/ui/sessionPicker";
import { recordedDataResponseSchemas } from "@/features/recordedData";
import { researchSessionResponseSchemas, type SessionSummary } from "@/features/researchSession";
import { tabGroupResponseSchemas } from "@/features/tabGroups";
import type { DataTopic } from "@/features/liveData";
import { useDataChanges, type WatchData } from "@/features/liveData/ui/useDataChanges";
import { getErrorMessage } from "@/shared/getErrorMessage";
import {
  buildRpcMessage,
  parseRpcMessage,
  type RpcMessage,
  rpcResponseSchemas,
} from "@/shared/rpc";
import { Button, Panel } from "@/shared/ui";

/**
 * The popup's end of its conversation with the background.
 *
 * One-shot rather than a port: nothing streams, and a popup lives only until
 * the user moves on, so there is no connection worth holding open.
 */
export interface PopupClient {
  request: (message: RpcMessage<string, unknown>) => Promise<unknown>;
  /** Hears that data changed, so the AI strip and banner follow the queue; absent in some tests. */
  watch?: WatchData;
}

/**
 * Access to page contents, which observing a session page needs. Optional: a
 * session is recorded without it, only without scroll, copies and page text.
 */
export interface PageAccess {
  isGranted: () => Promise<boolean>;
  /**
   * Asks the browser. Firefox honours it only within the user's click, so it
   * is called before anything is awaited in the handler that needs it.
   */
  request: () => Promise<boolean>;
}

export interface PopupAppProps {
  client: PopupClient;
  pageAccess: PageAccess;
  /** Opens the options page, where local AI is set up. */
  openSettings?: () => void;
}

/** Every answer the background may send this surface. */
const responseSchemas = {
  ...researchSessionResponseSchemas,
  ...tabGroupResponseSchemas,
  ...rpcResponseSchemas,
} as const;

/** An active session, as the popup lists and describes it. */
type ActiveSession = SessionSummary;

/**
 * What the popup shows: nothing yet, or the sessions being recorded — none, one
 * or several — and which of them it refers to.
 */
type PopupState =
  | { status: "loading" }
  | { status: "ready"; sessions: ActiveSession[]; viewedId: string | undefined };

/** The sessions and the viewed one an answer lists, or why it could not. */
const readAnswer = (answer: unknown): PopupState | { failure: string } => {
  const response = parseRpcMessage(answer, responseSchemas);

  switch (response.type) {
    case "session.active":
      return {
        status: "ready",
        sessions: response.payload.sessions,
        viewedId: response.payload.viewedId ?? undefined,
      };
    case "tabGroup.failed":
    case "rpc.refused":
    case "rpc.failed":
      return { failure: response.payload.reason };
    default:
      return { failure: `The background answered "${response.type}".` };
  }
};

/** Why starting a session failed, or `undefined` when it started. */
const readStartFailure = (answer: unknown): string | undefined => {
  const response = parseRpcMessage(answer, responseSchemas);

  switch (response.type) {
    case "tabGroup.created":
      return undefined;
    case "tabGroup.failed":
    case "rpc.refused":
    case "rpc.failed":
      return response.payload.reason;
    default:
      return `The background answered "${response.type}".`;
  }
};

/** Every answer the background may send to opening the map. */
const mapResponseSchemas = {
  ...researchMapResponseSchemas,
  ...rpcResponseSchemas,
} as const;

/** Why the map could not be opened, or `undefined` when it was. */
const readMapAnswer = (answer: unknown): string | undefined => {
  const response = parseRpcMessage(answer, mapResponseSchemas);

  switch (response.type) {
    case "map.opened":
      return undefined;
    case "rpc.refused":
    case "rpc.failed":
      return response.payload.reason;
    default:
      return `The map answered "${response.type}".`;
  }
};

/** Every answer the background may send about saved research. */
const libraryResponseSchemas = {
  ...researchLibraryResponseSchemas,
  ...recordedDataResponseSchemas,
  ...rpcResponseSchemas,
} as const;

/** The saved sessions an answer lists, or none when it lists none. */
const readLibrary = (answer: unknown): SavedSessionSummary[] => {
  const response = parseRpcMessage(answer, libraryResponseSchemas);

  return response.type === "library.listed" ? response.payload.sessions : [];
};

/** Why a resume or delete failed, or `undefined` when it did not. */
const readLibraryFailure = (answer: unknown): string | undefined => {
  const response = parseRpcMessage(answer, libraryResponseSchemas);

  switch (response.type) {
    case "session.resumeFailed":
    case "session.reattachFailed":
    case "rpc.refused":
    case "rpc.failed":
      return response.payload.reason;
    default:
      return undefined;
  }
};

/** Where the user stands with AI; `undefined` on any other answer. */
const readAiSetupStatus = (answer: unknown): AiSetupStatus | undefined => {
  const response = parseRpcMessage(answer, { ...aiSetupResponseSchemas, ...rpcResponseSchemas });

  return response.type === "aiSetup.status" ? response.payload : undefined;
};

/** What the local AI is doing; `undefined` on any other answer. */
const readActivityState = (answer: unknown): ActivityState | undefined => {
  const response = parseRpcMessage(answer, { ...aiActivityResponseSchemas, ...rpcResponseSchemas });

  return response.type === "aiActivity.state" ? response.payload : undefined;
};

interface AiAnswers {
  status?: AiSetupStatus;
  activity?: ActivityState;
}

/** Asks whether AI is set up and what it is doing; an answer that fails is left out. */
const requestAi = async (client: PopupClient): Promise<AiAnswers> => {
  const [status, activity] = await Promise.all([
    client
      .request(buildRpcMessage("aiSetup.read", {}))
      .then(readAiSetupStatus)
      .catch(() => undefined),
    client
      .request(buildRpcMessage("aiActivity.read", {}))
      .then(readActivityState)
      .catch(() => undefined),
  ]);

  return {
    ...(status === undefined ? {} : { status }),
    ...(activity === undefined ? {} : { activity }),
  };
};

/** What the AI strip and the setup banner show: the queue, and the models that set AI up. */
const AI_TOPICS: readonly DataTopic[] = ["jobs", "models"];

/** Composition root of the toolbar popup surface. */
export function PopupApp({ client, pageAccess, openSettings }: PopupAppProps) {
  const [state, setState] = useState<PopupState>({ status: "loading" });
  /** True while a start or a resume is in flight, so it is not sent twice. */
  const [isPending, setIsPending] = useState(false);
  /** Why the last start or resume failed, until the next one. */
  const [failure, setFailure] = useState<string | undefined>();
  const sessions = state.status === "ready" ? state.sessions : [];
  const viewed =
    state.status === "ready"
      ? (sessions.find(({ id }) => id === state.viewedId) ?? sessions[0])
      : undefined;
  /** The library is listed again when this changes: a closed group saves its session. */
  const libraryKey = state.status === "ready" ? sessions.map(({ id }) => id).join(",") : undefined;
  const [library, setLibrary] = useState<SavedSessionSummary[]>([]);
  const [aiSetup, setAiSetup] = useState<AiSetupStatus | undefined>();
  const [activity, setActivity] = useState<ActivityState | undefined>();

  /** Opens the setup page; Firefox closes the popup as the page takes focus. */
  const openSetup = useCallback(() => {
    client.request(buildRpcMessage("aiSetup.open", {})).catch(() => undefined);
  }, [client]);

  /** Folds or unfolds the banner, remembered by the background for the next open. */
  const toggleSetupBanner = useCallback(
    (isCollapsed: boolean) => {
      setAiSetup((previous) =>
        previous === undefined ? previous : { ...previous, isBannerCollapsed: isCollapsed },
      );
      client
        .request(buildRpcMessage("aiSetup.collapseBanner", { isCollapsed }))
        .catch(() => undefined);
    },
    [client],
  );

  // The saved sessions, whenever the popup offers to start one.
  useEffect(() => {
    if (libraryKey === undefined) {
      return undefined;
    }

    let isCurrent = true;

    client
      .request(buildRpcMessage("library.list", {}))
      .then(readLibrary)
      .then(
        (listed) => {
          if (isCurrent) {
            setLibrary(listed);
          }
        },
        () => undefined,
      );

    return () => {
      isCurrent = false;
    };
  }, [client, libraryKey]);

  const [mapFailure, setMapFailure] = useState<string | undefined>();
  /** `undefined` until the browser has said. */
  const [hasPageAccess, setHasPageAccess] = useState<boolean | undefined>();

  useEffect(() => {
    let isCurrent = true;

    pageAccess.isGranted().then(
      (isGranted) => {
        if (isCurrent) {
          setHasPageAccess(isGranted);
        }
      },
      () => undefined,
    );

    return () => {
      isCurrent = false;
    };
  }, [pageAccess]);

  /**
   * Asks for page access, from the click that called it. Opening the browser's
   * prompt may close the popup; whatever the answer, the background hears of a
   * grant itself.
   */
  const requestPageAccess = useCallback(() => {
    pageAccess.request().then(setHasPageAccess, () => undefined);
  }, [pageAccess]);

  // Asked on every open rather than remembered: the session lives in the
  // background's database, and its group may have closed since the last look.
  useEffect(() => {
    let isCurrent = true;

    client
      .request(buildRpcMessage("session.getActive", {}))
      .then(readAnswer)
      .then(
        (next) => {
          if (isCurrent) {
            if ("failure" in next) {
              setFailure(next.failure);
              setState({ status: "ready", sessions: [], viewedId: undefined });
            } else {
              setState(next);
            }
          }
        },
        (error: unknown) => {
          if (isCurrent) {
            setFailure(getErrorMessage(error));
            setState({ status: "ready", sessions: [], viewedId: undefined });
          }
        },
      );

    return () => {
      isCurrent = false;
    };
  }, [client]);

  /** Reads the sessions again, as the background has them now. */
  const refresh = useCallback(async () => {
    const next = readAnswer(await client.request(buildRpcMessage("session.getActive", {})));

    if ("failure" in next) {
      setFailure(next.failure);
    } else {
      setState(next);
    }
  }, [client]);

  /** Shows what the background said about AI; an answer it could not give leaves the last one. */
  const showAi = useCallback((answers: AiAnswers) => {
    if (answers.status !== undefined) {
      setAiSetup(answers.status);
    }

    if (answers.activity !== undefined) {
      setActivity(answers.activity);
    }
  }, []);

  // Whether AI is set up and what it is doing, read from storage on every open:
  // nothing here asks Ollama.
  useEffect(() => {
    let isCurrent = true;

    void requestAi(client).then((answers) => {
      if (isCurrent) {
        showAi(answers);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [client, showAi]);

  // Read again whenever the queue or the models change, so setup finishing
  // swaps the banner for the strip.
  const readAi = useCallback(async () => {
    showAi(await requestAi(client));
  }, [client, showAi]);

  useDataChanges(client.watch, AI_TOPICS, readAi);

  // The background does the work, so it finishes even if the user dismisses
  // the popup first. Firefox keeps the popup open when the extension itself
  // focuses the new tab (see the spike's Findings), so the answer is normally
  // seen.
  const startSession = useCallback(
    (title: string) => {
      // First, while the click is still the user's: Firefox refuses a
      // permission request made after anything has been awaited.
      if (hasPageAccess !== true) {
        requestPageAccess();
      }

      setIsPending(true);
      setFailure(undefined);

      // A reply this surface cannot parse is a failure too, so it is caught
      // by the same handler rather than escaping as an unhandled rejection.
      client
        .request(buildRpcMessage("tabGroup.create", { title }))
        .then(async (answer) => {
          const reason = readStartFailure(answer);

          if (reason === undefined) {
            await refresh();
          } else {
            setFailure(reason);
          }
        })
        .catch((error: unknown) => {
          setFailure(getErrorMessage(error));
        })
        .finally(() => {
          setIsPending(false);
        });
    },
    [client, hasPageAccess, refresh, requestPageAccess],
  );

  /**
   * Resumes a saved session beside the ones being recorded, and refers to it.
   * Nothing is closed, so a refusal changes nothing but the message.
   */
  const resume = useCallback(
    (sessionId: string) => {
      setIsPending(true);
      setFailure(undefined);

      client
        .request(buildRpcMessage("session.resume", { sessionId }))
        .then(async (answer) => {
          const reason = readLibraryFailure(answer);

          if (reason === undefined) {
            await refresh();
          } else {
            setFailure(reason);
          }
        })
        .catch((error: unknown) => {
          setFailure(getErrorMessage(error));
        })
        .finally(() => {
          setIsPending(false);
        });
    },
    [client, refresh],
  );

  /**
   * Chooses which active session the popup, and the pages opened from it,
   * refer to. Shown at once; the background has the last word.
   */
  const view = useCallback(
    (sessionId: string) => {
      setState((previous) =>
        previous.status === "ready" ? { ...previous, viewedId: sessionId } : previous,
      );
      client
        .request(buildRpcMessage("session.view", { sessionId }))
        .then(refresh)
        .catch((error: unknown) => {
          setMapFailure(getErrorMessage(error));
        });
    },
    [client, refresh],
  );

  /** Answers the offer to continue a saved session, then shows the session as it is now. */
  const answerReattach = useCallback(
    (message: RpcMessage<string, unknown>) => {
      client
        .request(message)
        .then(async (answer) => {
          const reason = readLibraryFailure(answer);

          if (reason !== undefined) {
            setMapFailure(reason);
          }

          await refresh();
        })
        .catch((error: unknown) => {
          setMapFailure(getErrorMessage(error));
        });
    },
    [client, refresh],
  );

  /** Deletes a saved session, then lists the library again. */
  const deleteSaved = useCallback(
    (sessionId: string) => {
      client
        .request(buildRpcMessage("session.delete", { sessionId }))
        .then(() => client.request(buildRpcMessage("library.list", {})))
        .then(readLibrary)
        .then(setLibrary)
        .catch(() => undefined);
    },
    [client],
  );

  // Opened like the map: the background finds its tab or opens one outside groups.
  const openRecorded = useCallback(() => {
    client
      .request(buildRpcMessage("recorded.open", { sessionId: viewed?.id }))
      .catch((error: unknown) => {
        setMapFailure(getErrorMessage(error));
      });
  }, [client, viewed?.id]);

  // Opened like the recorded page, beside it.
  const openSummaries = useCallback(() => {
    client
      .request(buildRpcMessage("summaries.open", { sessionId: viewed?.id }))
      .catch((error: unknown) => {
        setMapFailure(getErrorMessage(error));
      });
  }, [client, viewed?.id]);

  // The background finds the viewed session's map tab or opens one, outside any group.
  const openMap = useCallback(() => {
    client
      .request(buildRpcMessage("map.open", { sessionId: viewed?.id }))
      .then(readMapAnswer)
      .then(setMapFailure, (error: unknown) => {
        setMapFailure(getErrorMessage(error));
      });
  }, [client, viewed?.id]);

  return (
    <Panel>
      {aiSetup !== undefined && !aiSetup.isSetUp && (
        <SetupBanner
          isCollapsed={aiSetup.isBannerCollapsed}
          onSetUp={openSetup}
          onToggle={toggleSetupBanner}
        />
      )}
      {aiSetup?.isSetUp === true && activity !== undefined && (
        <ActivityStrip state={activity} onOpenSetup={openSetup} />
      )}
      {state.status !== "loading" && (
        <div className="mt-3">
          <SessionPicker
            active={sessions}
            {...(viewed === undefined ? {} : { viewedId: viewed.id })}
            saved={library}
            pending={isPending}
            onCreate={startSession}
            onView={view}
            onResume={resume}
            onDelete={deleteSaved}
          />
        </div>
      )}
      {failure !== undefined && (
        <p
          data-testid="group-error"
          role="alert"
          className="mt-2 text-sm text-red-700 dark:text-red-400"
        >
          {failure}
        </p>
      )}
      {viewed !== undefined && (
        <p className="mt-2 text-sm">
          <span data-testid="session-active">Session “{viewed.title}” is active.</span>{" "}
          <span data-testid="session-page-count">
            {viewed.pageCount === 1 ? "1 page recorded" : `${viewed.pageCount} pages recorded`}
          </span>
        </p>
      )}
      {viewed?.reattachSuggestion !== undefined && (
        <div data-testid="reattach-offer" role="group" className="mt-2 text-sm">
          <p>This looks like “{viewed.reattachSuggestion.title}”. Continue that research here?</p>
          <div className="mt-1 flex gap-2">
            <Button
              data-testid="reattach-continue"
              onClick={() => {
                answerReattach(
                  buildRpcMessage("session.reattach", {
                    savedSessionId: viewed.reattachSuggestion?.sessionId ?? "",
                  }),
                );
              }}
            >
              Continue
            </Button>
            <Button
              data-testid="reattach-keep-separate"
              onClick={() => {
                answerReattach(buildRpcMessage("session.keepSeparate", {}));
              }}
            >
              Keep separate
            </Button>
          </div>
        </div>
      )}
      {viewed?.lastPosition !== undefined && (
        <p data-testid="left-off" className="mt-1 text-sm">
          {formatLeftOff(viewed.lastPosition)}
        </p>
      )}
      {viewed !== undefined && (
        <div className="mt-3">
          <Button data-testid="open-map" onClick={openMap}>
            Open map
          </Button>{" "}
          <Button data-testid="open-recorded" onClick={openRecorded}>
            What was recorded
          </Button>{" "}
          <Button data-testid="open-summaries" onClick={openSummaries}>
            Synthesis
          </Button>
        </div>
      )}
      {viewed !== undefined && hasPageAccess === false && (
        <div data-testid="page-access-missing" className="mt-3 text-sm">
          <p>
            Reading and scrolling are not being recorded: the extension has no access to page
            contents.
          </p>
          <div className="mt-2">
            <Button data-testid="allow-page-access" onClick={requestPageAccess}>
              Allow page access
            </Button>
          </div>
        </div>
      )}
      {viewed !== undefined && mapFailure !== undefined && (
        <p
          data-testid="map-error"
          role="alert"
          className="mt-2 text-sm text-red-700 dark:text-red-400"
        >
          {mapFailure}
        </p>
      )}
      {openSettings !== undefined && (
        <p className="mt-3 text-right text-xs">
          <button
            type="button"
            data-testid="open-settings"
            className="underline"
            onClick={openSettings}
          >
            Settings
          </button>
        </p>
      )}
    </Panel>
  );
}
