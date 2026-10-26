import { useCallback, useEffect, useRef, useState } from "react";

import {
  type GraphSnapshot,
  type MapView,
  researchMapResponseSchemas,
} from "@/features/researchMap";
import { DEFAULT_MAP_VIEW, MAP_VIEWS } from "@/features/researchMap/constants";
import { parseMapView } from "@/features/researchMap/model/parseMapView";
import { AnchorView } from "@/features/researchMap/ui/anchorView";
import { HistoryView } from "@/features/researchMap/ui/historyView";
import { ResearchMap } from "@/features/researchMap/ui/researchMap";
import { TelemetryView } from "@/features/researchMap/ui/telemetryView";
import { ViewSwitcher } from "@/features/researchMap/ui/viewSwitcher";
import {
  buildRpcMessage,
  parseRpcMessage,
  type RpcMessage,
  RpcMessageError,
  rpcResponseSchemas,
} from "@/shared/rpc";
import { readPinnedSessionId } from "@/shared/readPinnedSessionId";

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

/** Whether a key press was meant for a field rather than for the page. */
const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Composition root of the research map page.
 *
 * The page draws one session four ways — a plain history, the tree,
 * its anchors, and a telemetry timeline — picked by the switcher or the keys
 * 1–4. The view is kept in the address (`#telemetry`), so a reload keeps it.
 */
export function MapApp({ client }: MapAppProps) {
  /** The session the map was opened for; a map opened without one follows the viewed session. */
  const [pinnedId] = useState(() => readPinnedSessionId(window.location.search));
  const [state, setState] = useState<MapState>({ status: "loading" });
  /** Why the last activated page could not be shown, until one can. */
  const [failure, setFailure] = useState<string | undefined>();
  const [view, setView] = useState<MapView>(() => parseMapView(window.location.hash));
  /** Captured text the telemetry view asked for, by page; `null` when there is none. */
  const [excerpts, setExcerpts] = useState<Record<string, string | null>>({});
  /** Pages whose text was asked for, so hovering a page again does not ask twice. */
  const askedExcerpts = useRef(new Set<string>());

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
        case "map.excerpt": {
          const { nodeId, text } = response.payload;

          setExcerpts((held) => ({ ...held, [nodeId]: text }));
          break;
        }
        case "map.opened":
          // Asked for by the popup, never by this page.
          break;
      }
    });

    // Sent after listening, so the first snapshot cannot arrive unheard.
    client.send(
      buildRpcMessage("graph.subscribe", pinnedId === undefined ? {} : { sessionId: pinnedId }),
    );

    return unsubscribe;
  }, [client, pinnedId]);

  useEffect(() => {
    document.title =
      state.status === "ready" && state.snapshot.session !== null
        ? `Research map: ${state.snapshot.session.title}`
        : "Research map";
  }, [state]);

  const focusTab = useCallback(
    (tabId: number) => {
      client.send(buildRpcMessage("tab.focus", { tabId }));
    },
    [client],
  );

  const readExcerpt = useCallback(
    (nodeId: string) => {
      if (!askedExcerpts.current.has(nodeId)) {
        askedExcerpts.current.add(nodeId);
        client.send(
          buildRpcMessage(
            "map.readExcerpt",
            pinnedId === undefined ? { nodeId } : { nodeId, sessionId: pinnedId },
          ),
        );
      }
    },
    [client, pinnedId],
  );

  const changeView = useCallback((next: MapView) => {
    setView(next);
    // The default view needs no fragment: the plain address already opens it.
    window.history.replaceState(
      null,
      "",
      // The query stays: it is what pins the page to its session.
      next === DEFAULT_MAP_VIEW
        ? `${window.location.pathname}${window.location.search}`
        : `#${next}`,
    );
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) {
        return;
      }

      const picked = MAP_VIEWS[Number(event.key) - 1];

      if (picked !== undefined) {
        changeView(picked);
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [changeView]);

  return (
    <main className="flex h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex items-center gap-3 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <h1 className="text-sm font-semibold">Research map</h1>
        <ViewSwitcher view={view} onChange={changeView} />
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
            {pinnedId === undefined
              ? "No active research session."
              : "This session is gone: it was deleted."}
          </p>
        )}
        {state.status === "ready" && view === "history" && (
          <HistoryView snapshot={state.snapshot} onFocusTab={focusTab} />
        )}
        {state.status === "ready" && view === "tree" && (
          <ResearchMap snapshot={state.snapshot} onFocusTab={focusTab} />
        )}
        {state.status === "ready" && view === "anchors" && (
          <AnchorView snapshot={state.snapshot} onFocusTab={focusTab} />
        )}
        {state.status === "ready" && view === "telemetry" && (
          <TelemetryView
            snapshot={state.snapshot}
            excerpts={excerpts}
            onReadExcerpt={readExcerpt}
            onFocusTab={focusTab}
          />
        )}
      </div>
    </main>
  );
}
