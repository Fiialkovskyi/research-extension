import { useCallback, useEffect, useState } from "react";

import { Greeting } from "@/features/greeting/ui/greeting";
import { type GraphSnapshot, researchMapResponseSchemas } from "@/features/researchMap";
import { buildResearchTree, listUnreadPages, type TreeFocus } from "@/features/researchTree";
import { ResearchTree } from "@/features/researchTree/ui/researchTree";
import { UnreadQueue } from "@/features/researchTree/ui/unreadQueue";
import { researchSessionResponseSchemas } from "@/features/researchSession";
import { tabGroupResponseSchemas } from "@/features/tabGroups";
import { GroupForm } from "@/features/tabGroups/ui/groupForm";
import { getErrorMessage } from "@/shared/getErrorMessage";
import {
  buildRpcMessage,
  parseRpcMessage,
  type RpcMessage,
  RpcMessageError,
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

/**
 * A long-lived connection for the research tree: the background answers a
 * subscription with the graph and pushes it again after every change, until
 * the popup closes and the connection with it.
 */
export interface GraphStream {
  send: (message: RpcMessage<string, unknown>) => void;
  /** Registers a listener and returns the function that removes it. */
  subscribe: (listener: (message: unknown) => void) => () => void;
}

export interface PopupAppProps {
  client: PopupClient;
  pageAccess: PageAccess;
  graph: GraphStream;
}

/** Every answer the background may send this surface. */
const responseSchemas = {
  ...researchSessionResponseSchemas,
  ...tabGroupResponseSchemas,
  ...rpcResponseSchemas,
} as const;

/**
 * What the popup shows: nothing yet, the form to start a session (with the
 * last failure, if any, and the closed session a start would end), or the
 * session that is active.
 */
type PopupState =
  | { status: "loading" }
  | { status: "ready"; pending: boolean; failure?: string; closedTitle?: string }
  | { status: "active"; title: string; pageCount: number };

/** Turns the background's answer into what the popup shows. */
const readAnswer = (answer: unknown): PopupState => {
  const response = parseRpcMessage(answer, responseSchemas);

  switch (response.type) {
    case "session.active":
      if (response.payload.session !== null) {
        return {
          status: "active",
          title: response.payload.session.title,
          pageCount: response.payload.session.pageCount,
        };
      }

      return response.payload.closedSession === null
        ? { status: "ready", pending: false }
        : { status: "ready", pending: false, closedTitle: response.payload.closedSession.title };
    case "tabGroup.created":
      // A session that has just started has recorded nothing yet.
      return { status: "active", title: response.payload.title, pageCount: 0 };
    case "tabGroup.failed":
    case "rpc.refused":
    case "rpc.failed":
      return { status: "ready", pending: false, failure: response.payload.reason };
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

/** Every message the graph stream may carry to this surface. */
const graphResponseSchemas = {
  ...researchMapResponseSchemas,
  ...rpcResponseSchemas,
} as const;

/** A request that failed or was answered with nothing this surface reads. */
const readFailure = (error: unknown): PopupState => {
  return { status: "ready", pending: false, failure: getErrorMessage(error) };
};

/** Composition root of the toolbar popup surface. */
export function PopupApp({ client, pageAccess, graph }: PopupAppProps) {
  const [state, setState] = useState<PopupState>({ status: "loading" });
  const [snapshot, setSnapshot] = useState<GraphSnapshot | undefined>();
  /** Kept apart from the snapshot, so a new one leaves collapsed rows collapsed. */
  const [treeFocus, setTreeFocus] = useState<TreeFocus>({
    focusedId: undefined,
    collapsed: new Set(),
  });
  const isActive = state.status === "active";

  // The tree follows the graph for as long as the popup is open.
  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const unsubscribe = graph.subscribe((message) => {
      let response;

      try {
        response = parseRpcMessage(message, graphResponseSchemas);
      } catch (error) {
        // A message this surface cannot validate is not its to render.
        if (error instanceof RpcMessageError) {
          return;
        }

        throw error;
      }

      if (response.type === "graph.snapshot") {
        setSnapshot(response.payload.session === null ? undefined : response.payload);
      }
    });

    // Sent after listening, so the first snapshot cannot arrive unheard.
    graph.send(buildRpcMessage("graph.subscribe", {}));

    return unsubscribe;
  }, [graph, isActive]);

  const focusTab = useCallback(
    (tabId: number) => {
      graph.send(buildRpcMessage("tab.focus", { tabId }));
    },
    [graph],
  );
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
            setState(next);
          }
        },
        (error: unknown) => {
          if (isCurrent) {
            setState(readFailure(error));
          }
        },
      );

    return () => {
      isCurrent = false;
    };
  }, [client]);

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

      setState({ status: "ready", pending: true });

      // A reply this surface cannot parse is a failure too, so it is caught
      // by the same handler rather than escaping as an unhandled rejection.
      client
        .request(buildRpcMessage("tabGroup.create", { title }))
        .then(readAnswer)
        .then(setState, (error: unknown) => {
          setState(readFailure(error));
        });
    },
    [client, hasPageAccess, requestPageAccess],
  );

  // Opened like the map: the background finds its tab or opens one outside groups.
  const openRecorded = useCallback(() => {
    client.request(buildRpcMessage("recorded.open", {})).catch((error: unknown) => {
      setMapFailure(getErrorMessage(error));
    });
  }, [client]);

  // The background finds the map's tab or opens one, outside the session's group.
  const openMap = useCallback(() => {
    client
      .request(buildRpcMessage("map.open", {}))
      .then(readMapAnswer)
      .then(setMapFailure, (error: unknown) => {
        setMapFailure(getErrorMessage(error));
      });
  }, [client]);

  return (
    <Panel>
      <Greeting />
      {state.status === "ready" && state.closedTitle !== undefined && (
        <p data-testid="session-closed" className="mt-2 text-sm">
          Session “{state.closedTitle}” is closed. Restore its group or one of its tabs to go on
          with it; starting a new session ends it.
        </p>
      )}
      {state.status === "ready" && state.closedTitle !== undefined && (
        <div className="mt-2">
          <Button data-testid="open-recorded" onClick={openRecorded}>
            What was recorded
          </Button>
        </div>
      )}
      {state.status === "ready" && <GroupForm pending={state.pending} onSubmit={startSession} />}
      {state.status === "ready" && state.failure !== undefined && (
        <p
          data-testid="group-error"
          role="alert"
          className="mt-2 text-sm text-red-700 dark:text-red-400"
        >
          {state.failure}
        </p>
      )}
      {state.status === "active" && (
        <p className="mt-2 text-sm">
          <span data-testid="session-active">Session “{state.title}” is active.</span>{" "}
          <span data-testid="session-page-count">
            {state.pageCount === 1 ? "1 page recorded" : `${state.pageCount} pages recorded`}
          </span>
        </p>
      )}
      {state.status === "active" && (
        <div className="mt-3">
          <Button data-testid="open-map" onClick={openMap}>
            Open map
          </Button>{" "}
          <Button data-testid="open-recorded" onClick={openRecorded}>
            What was recorded
          </Button>
        </div>
      )}
      {state.status === "active" && hasPageAccess === false && (
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
      {state.status === "active" && snapshot !== undefined && (
        <div className="mt-3 flex max-h-96 flex-col gap-2 overflow-y-auto">
          <UnreadQueue pages={listUnreadPages(snapshot.nodes)} onFocusTab={focusTab} />
          <ResearchTree
            forest={buildResearchTree(snapshot.nodes, snapshot.clusters)}
            focus={treeFocus}
            onFocusChange={setTreeFocus}
            onFocusTab={focusTab}
          />
        </div>
      )}
      {state.status === "active" && mapFailure !== undefined && (
        <p
          data-testid="map-error"
          role="alert"
          className="mt-2 text-sm text-red-700 dark:text-red-400"
        >
          {mapFailure}
        </p>
      )}
    </Panel>
  );
}
