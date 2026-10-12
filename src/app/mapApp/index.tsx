import { useCallback, useEffect, useState } from "react";

import { type GraphSnapshot, researchMapResponseSchemas } from "@/features/researchMap";
import { ResearchMap } from "@/features/researchMap/ui/researchMap";
import {
  buildRpcMessage,
  parseRpcMessage,
  type RpcMessage,
  RpcMessageError,
  rpcResponseSchemas,
} from "@/shared/rpc";

/**
 * The map's end of its connection to the background.
 *
 * A port rather than one-shot messages: the background pushes a new snapshot
 * on it after every change, for as long as the map is open.
 */
export interface MapClient {
  send: (message: RpcMessage<string, unknown>) => void;
  /** Registers a listener and returns the function that removes it. */
  subscribe: (listener: (message: unknown) => void) => () => void;
}

export interface MapAppProps {
  client: MapClient;
}

/** Every answer the background may send this surface. */
const responseSchemas = {
  ...researchMapResponseSchemas,
  ...rpcResponseSchemas,
} as const;

/** What the map shows: nothing yet, that no session is active, or a session's graph. */
type MapState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; snapshot: GraphSnapshot };

/** Composition root of the research map page. */
export function MapApp({ client }: MapAppProps) {
  const [state, setState] = useState<MapState>({ status: "loading" });
  /** Why the last activated page could not be shown, until one can. */
  const [failure, setFailure] = useState<string | undefined>();

  useEffect(() => {
    const unsubscribe = client.subscribe((message) => {
      let response;

      try {
        response = parseRpcMessage(message, responseSchemas);
      } catch (error) {
        // A message this surface cannot validate is not its to render.
        if (error instanceof RpcMessageError) {
          return;
        }

        throw error;
      }

      switch (response.type) {
        case "graph.snapshot":
          setState(
            response.payload.session === null
              ? { status: "empty" }
              : { status: "ready", snapshot: response.payload },
          );
          break;
        case "tab.focused":
          setFailure(undefined);
          break;
        case "tab.focusRefused":
          setFailure(response.payload.reason);
          break;
        case "rpc.refused":
        case "rpc.failed":
          setFailure(response.payload.reason);
          break;
        case "map.opened":
          // Asked for by the popup, never by this page.
          break;
      }
    });

    // Sent after listening, so the first snapshot cannot arrive unheard.
    client.send(buildRpcMessage("graph.subscribe", {}));

    return unsubscribe;
  }, [client]);

  const focusTab = useCallback(
    (tabId: number) => {
      client.send(buildRpcMessage("tab.focus", { tabId }));
    },
    [client],
  );

  return (
    <main className="flex h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex items-baseline gap-3 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <h1 className="text-sm font-semibold">Research map</h1>
        {state.status === "ready" && (
          <span data-testid="map-session-title" className="truncate text-sm">
            {state.snapshot.session?.title}
          </span>
        )}
        {failure !== undefined && (
          <p
            data-testid="map-error"
            role="alert"
            className="ml-auto text-sm text-red-700 dark:text-red-400"
          >
            {failure}
          </p>
        )}
      </header>
      <div className="min-h-0 flex-1">
        {state.status === "loading" && (
          <p data-testid="map-loading" className="p-4 text-sm">
            Loading…
          </p>
        )}
        {state.status === "empty" && (
          <p data-testid="map-empty" className="p-4 text-sm">
            No active research session.
          </p>
        )}
        {state.status === "ready" && (
          <ResearchMap snapshot={state.snapshot} onFocusTab={focusTab} />
        )}
      </div>
    </main>
  );
}
