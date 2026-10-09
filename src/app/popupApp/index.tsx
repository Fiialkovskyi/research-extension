import { useCallback, useState } from "react";

import { Greeting } from "@/features/greeting/ui/greeting";
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
const responseSchemas = { ...tabGroupResponseSchemas, ...rpcResponseSchemas } as const;

type SessionStart =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "started"; title: string }
  | { status: "failed"; reason: string };

/** Turns the background's answer into what the popup shows. */
const readAnswer = (answer: unknown): SessionStart => {
  const response = parseRpcMessage(answer, responseSchemas);

  switch (response.type) {
    case "tabGroup.created":
      return { status: "started", title: response.payload.title };
    case "tabGroup.failed":
    case "rpc.refused":
    case "rpc.failed":
      return { status: "failed", reason: response.payload.reason };
  }
};

/** Composition root of the toolbar popup surface. */
export function PopupApp({ client }: PopupAppProps) {
  const [start, setStart] = useState<SessionStart>({ status: "idle" });

  // The background does the work, so it finishes even if the user dismisses
  // the popup first. Firefox keeps the popup open when the extension itself
  // focuses the new tab (see the spike's Findings), so the answer is normally
  // seen.
  const startSession = useCallback(
    (title: string) => {
      setStart({ status: "pending" });

      // A reply this surface cannot parse is a failure too, so it is caught
      // by the same handler rather than escaping as an unhandled rejection.
      client
        .request(buildRpcMessage("tabGroup.create", { title }))
        .then(readAnswer)
        .then(setStart, (error: unknown) => {
          setStart({ status: "failed", reason: getErrorMessage(error) });
        });
    },
    [client],
  );

  return (
    <Panel>
      <Greeting />
      <GroupForm pending={start.status === "pending"} onSubmit={startSession} />
      {start.status === "failed" && (
        <p
          data-testid="group-error"
          role="alert"
          className="mt-2 text-sm text-red-700 dark:text-red-400"
        >
          {start.reason}
        </p>
      )}
      {start.status === "started" && (
        <p data-testid="group-started" className="mt-2 text-sm">
          Started “{start.title}”.
        </p>
      )}
    </Panel>
  );
}
