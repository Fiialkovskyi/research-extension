import { useCallback, useEffect, useState } from "react";

import { Greeting } from "@/features/greeting/ui/greeting";
import { researchSessionResponseSchemas } from "@/features/researchSession";
import { tabGroupResponseSchemas } from "@/features/tabGroups";
import { GroupForm } from "@/features/tabGroups/ui/groupForm";
import { getErrorMessage } from "@/shared/getErrorMessage";
import {
  buildRpcMessage,
  parseRpcMessage,
  type RpcMessage,
  rpcResponseSchemas,
} from "@/shared/rpc";
import { Panel } from "@/shared/ui";

/**
 * The popup's end of its conversation with the background.
 *
 * One-shot rather than a port: nothing streams, and a popup lives only until
 * the user moves on, so there is no connection worth holding open.
 */
export interface PopupClient {
  request: (message: RpcMessage<string, unknown>) => Promise<unknown>;
}

export interface PopupAppProps {
  client: PopupClient;
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
  | { status: "active"; title: string };

/** Turns the background's answer into what the popup shows. */
const readAnswer = (answer: unknown): PopupState => {
  const response = parseRpcMessage(answer, responseSchemas);

  switch (response.type) {
    case "session.active":
      if (response.payload.session !== null) {
        return { status: "active", title: response.payload.session.title };
      }

      return response.payload.closedSession === null
        ? { status: "ready", pending: false }
        : { status: "ready", pending: false, closedTitle: response.payload.closedSession.title };
    case "tabGroup.created":
      return { status: "active", title: response.payload.title };
    case "tabGroup.failed":
    case "rpc.refused":
    case "rpc.failed":
      return { status: "ready", pending: false, failure: response.payload.reason };
  }
};

/** A request that failed or was answered with nothing this surface reads. */
const readFailure = (error: unknown): PopupState => {
  return { status: "ready", pending: false, failure: getErrorMessage(error) };
};

/** Composition root of the toolbar popup surface. */
export function PopupApp({ client }: PopupAppProps) {
  const [state, setState] = useState<PopupState>({ status: "loading" });

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
    [client],
  );

  return (
    <Panel>
      <Greeting />
      {state.status === "ready" && state.closedTitle !== undefined && (
        <p data-testid="session-closed" className="mt-2 text-sm">
          Session “{state.closedTitle}” is closed. Restore its group or one of its tabs to go on
          with it; starting a new session ends it.
        </p>
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
        <p data-testid="session-active" className="mt-2 text-sm">
          Session “{state.title}” is active.
        </p>
      )}
    </Panel>
  );
}
