import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildRpcMessage, type RpcMessage } from "@/shared/rpc";
import { act } from "react";

import { type GraphStream, type PageAccess, PopupApp, type PopupClient } from "./index";

interface ClientAnswers {
  /** The active session's title, or `null` for none. */
  active?: string | null;
  /** Pages the active session has recorded. */
  pageCount?: number;
  /** The closed session's title, or `null` for none. */
  closed?: string | null;
  /** The answer to a start; a rejection when it is an `Error`. */
  start?: unknown;
  /** The answer to opening the map. */
  map?: unknown;
}

/** A background that reports `active` when asked, and answers a start with `start`. */
const createClient = ({
  active = null,
  pageCount = 0,
  closed = null,
  start,
  map = buildRpcMessage("map.opened", {}),
}: ClientAnswers = {}): PopupClient => ({
  request: vi.fn((message: RpcMessage<string, unknown>) => {
    if (message.type === "map.open") {
      return Promise.resolve(map);
    }

    if (message.type === "session.getActive") {
      return Promise.resolve(
        buildRpcMessage("session.active", {
          session:
            active === null ? null : { id: "session-1", title: active, groupId: 42, pageCount },
          closedSession:
            closed === null ? null : { id: "session-0", title: closed, groupId: 41, pageCount: 0 },
        }),
      );
    }

    return start instanceof Error ? Promise.reject(start) : Promise.resolve(start);
  }),
});

/** A graph stream the test pushes snapshots through, recording what the popup sends. */
const buildGraph = (): GraphStream & {
  sent: RpcMessage<string, unknown>[];
  push: (message: unknown) => void;
} => {
  const listeners = new Set<(message: unknown) => void>();
  const sent: RpcMessage<string, unknown>[] = [];

  return {
    sent,
    send: (message) => {
      sent.push(message);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    push: (message) => {
      act(() => {
        for (const listener of listeners) {
          listener(message);
        }
      });
    },
  };
};

/** Page access as the browser reports it; granted unless a test says otherwise. */
const buildPageAccess = ({
  isGranted = true,
  request = () => Promise.resolve(true),
}: { isGranted?: boolean; request?: () => Promise<boolean> } = {}): PageAccess & {
  request: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
} => ({
  isGranted: () => Promise.resolve(isGranted),
  request: vi.fn(request),
});

const startSession = async (title: string) => {
  fireEvent.change(await screen.findByLabelText("Session title"), { target: { value: title } });
  fireEvent.click(screen.getByTestId("group-submit"));
};

/** A page as the graph stream reports it. */
const node = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Page ${id.toUpperCase()}`,
  url: `https://example.org/${id}`,
  domain: "example.org",
  kind: "page",
  tabId: 7,
  tabState: "open",
  engagement: "skimmed",
  copyEvents: 0,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  createdAt: 1,
  ...overrides,
});
/** The active session's graph with these pages. */
const snapshot = (...nodes: ReturnType<typeof node>[]) =>
  buildRpcMessage("graph.snapshot", {
    session: { id: "session-1", title: "E-bike motors" },
    nodes,
    edges: [],
  });

describe("PopupApp", () => {
  it("shows the greeting inside the popup panel", () => {
    render(
      <PopupApp graph={buildGraph()} client={createClient()} pageAccess={buildPageAccess()} />,
    );

    const panel = screen.getByTestId("popup-panel");

    expect(panel).toBeInTheDocument();
    expect(panel).toContainElement(screen.getByText("Hello World"));
  });

  it("offers the title form when no session is active", async () => {
    render(
      <PopupApp graph={buildGraph()} client={createClient()} pageAccess={buildPageAccess()} />,
    );

    expect(await screen.findByLabelText("Session title")).toBeInTheDocument();
    expect(screen.queryByTestId("session-active")).not.toBeInTheDocument();
  });

  it("shows the active session instead of the form", async () => {
    render(
      <PopupApp
        graph={buildGraph()}
        client={createClient({ active: "E-bike motors" })}
        pageAccess={buildPageAccess()}
      />,
    );

    expect(await screen.findByTestId("session-active")).toHaveTextContent("E-bike motors");
    expect(screen.queryByLabelText("Session title")).not.toBeInTheDocument();
  });

  it("says how many pages the active session has recorded", async () => {
    render(
      <PopupApp
        graph={buildGraph()}
        client={createClient({ active: "E-bike motors", pageCount: 2 })}
        pageAccess={buildPageAccess()}
      />,
    );

    expect(await screen.findByTestId("session-page-count")).toHaveTextContent("2 pages recorded");
  });

  it("offers the map only while a session is active", async () => {
    render(
      <PopupApp graph={buildGraph()} client={createClient()} pageAccess={buildPageAccess()} />,
    );

    await screen.findByLabelText("Session title");

    expect(screen.queryByTestId("open-map")).not.toBeInTheDocument();
  });

  it("asks the background to open the map", async () => {
    const client = createClient({ active: "E-bike motors" });
    render(<PopupApp graph={buildGraph()} client={client} pageAccess={buildPageAccess()} />);

    fireEvent.click(await screen.findByTestId("open-map"));

    expect(client.request).toHaveBeenCalledWith(expect.objectContaining({ type: "map.open" }));
    await vi.waitFor(() => expect(client.request).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("map-error")).not.toBeInTheDocument();
  });

  it("says why the map could not be opened", async () => {
    const client = createClient({
      active: "E-bike motors",
      map: buildRpcMessage("rpc.failed", { requestType: "map.open", reason: "No window." }),
    });
    render(<PopupApp graph={buildGraph()} client={client} pageAccess={buildPageAccess()} />);

    fireEvent.click(await screen.findByTestId("open-map"));

    expect(await screen.findByTestId("map-error")).toHaveTextContent("No window.");
  });

  it("says a single page in the singular", async () => {
    render(
      <PopupApp
        graph={buildGraph()}
        client={createClient({ active: "E-bike motors", pageCount: 1 })}
        pageAccess={buildPageAccess()}
      />,
    );

    expect(await screen.findByTestId("session-page-count")).toHaveTextContent("1 page recorded");
  });

  it("names a closed session beside the form, saying a new start ends it", async () => {
    render(
      <PopupApp
        graph={buildGraph()}
        client={createClient({ closed: "E-bike motors" })}
        pageAccess={buildPageAccess()}
      />,
    );

    expect(await screen.findByTestId("session-closed")).toHaveTextContent(
      /“E-bike motors” is closed.*starting a new session ends it/,
    );
    expect(screen.getByLabelText("Session title")).toBeInTheDocument();
  });

  it("asks the background to start a session, then shows it as active", async () => {
    const client = createClient({
      start: buildRpcMessage("tabGroup.created", {
        groupId: 1,
        tabId: 2,
        title: "Motors",
        color: "blue",
      }),
    });
    render(<PopupApp graph={buildGraph()} client={client} pageAccess={buildPageAccess()} />);

    await startSession("Motors");

    expect(await screen.findByTestId("session-active")).toHaveTextContent("Motors");
    expect(screen.queryByLabelText("Session title")).not.toBeInTheDocument();
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({ type: "tabGroup.create", payload: { title: "Motors" } }),
    );
  });

  it("shows why the session could not be started, and keeps the form", async () => {
    render(
      <PopupApp
        graph={buildGraph()}
        client={createClient({ start: buildRpcMessage("tabGroup.failed", { reason: "refused" }) })}
        pageAccess={buildPageAccess()}
      />,
    );

    await startSession("Motors");

    expect(await screen.findByRole("alert")).toHaveTextContent("refused");
    expect(screen.getByLabelText("Session title")).toBeInTheDocument();
  });

  it("shows a protocol refusal as a failure too", async () => {
    const start = buildRpcMessage("rpc.refused", {
      rejection: "invalid-payload",
      reason: "bad title",
    });
    render(
      <PopupApp
        graph={buildGraph()}
        client={createClient({ start })}
        pageAccess={buildPageAccess()}
      />,
    );

    await startSession("Motors");

    expect(await screen.findByRole("alert")).toHaveTextContent("bad title");
  });

  it("shows a failure when the background cannot be reached", async () => {
    render(
      <PopupApp
        graph={buildGraph()}
        client={createClient({ start: new Error("no receiver") })}
        pageAccess={buildPageAccess()}
      />,
    );

    await startSession("Motors");

    expect(await screen.findByRole("alert")).toHaveTextContent("no receiver");
  });

  it("shows a reply it cannot understand as a failure", async () => {
    render(
      <PopupApp
        graph={buildGraph()}
        client={createClient({ start: "not an envelope" })}
        pageAccess={buildPageAccess()}
      />,
    );

    await startSession("Motors");

    expect(await screen.findByRole("alert")).toHaveTextContent(/envelope/);
  });

  it("still offers the form when the active session cannot be read", async () => {
    const client: PopupClient = { request: vi.fn().mockRejectedValue(new Error("no receiver")) };
    render(<PopupApp graph={buildGraph()} client={client} pageAccess={buildPageAccess()} />);

    expect(await screen.findByLabelText("Session title")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("no receiver");
  });

  describe("page access", () => {
    it("asks for page access when a session starts, before asking the background", async () => {
      const calls: string[] = [];
      const pageAccess = buildPageAccess({ isGranted: false });
      const client = createClient({
        start: buildRpcMessage("tabGroup.created", {
          groupId: 42,
          tabId: 7,
          title: "E-bike motors",
          color: "blue",
        }),
      });

      pageAccess.request.mockImplementation(() => {
        calls.push("permission");
        return Promise.resolve(true);
      });
      vi.mocked(client.request).mockImplementationOnce((message) => {
        calls.push(message.type);
        return Promise.resolve(
          buildRpcMessage("session.active", { session: null, closedSession: null }),
        );
      });
      render(<PopupApp graph={buildGraph()} client={client} pageAccess={pageAccess} />);
      await screen.findByLabelText("Session title");
      await vi.waitFor(() => expect(calls).toEqual(["session.getActive"]));

      vi.mocked(client.request).mockImplementation((message) => {
        calls.push(message.type);
        return Promise.resolve(
          buildRpcMessage("tabGroup.created", {
            groupId: 42,
            tabId: 7,
            title: "E-bike motors",
            color: "blue",
          }),
        );
      });
      await startSession("E-bike motors");

      expect(calls).toEqual(["session.getActive", "permission", "tabGroup.create"]);
    });

    it("does not ask again when page access is already granted", async () => {
      const pageAccess = buildPageAccess();

      render(<PopupApp graph={buildGraph()} client={createClient()} pageAccess={pageAccess} />);
      await vi.waitFor(() => expect(screen.getByLabelText("Session title")).toBeInTheDocument());
      // Let the granted state arrive before the click.
      await Promise.resolve();
      await startSession("E-bike motors");

      expect(pageAccess.request).not.toHaveBeenCalled();
    });

    it("starts the session even when page access is refused", async () => {
      const pageAccess = buildPageAccess({
        isGranted: false,
        request: () => Promise.reject(new Error("Refused")),
      });
      const client = createClient();

      render(<PopupApp graph={buildGraph()} client={client} pageAccess={pageAccess} />);
      await startSession("E-bike motors");

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ type: "tabGroup.create" }),
      );
    });

    it("says what is not recorded during a session without page access, and asks again", async () => {
      const pageAccess = buildPageAccess({ isGranted: false });

      render(
        <PopupApp
          graph={buildGraph()}
          client={createClient({ active: "E-bike motors" })}
          pageAccess={pageAccess}
        />,
      );

      expect(await screen.findByTestId("page-access-missing")).toHaveTextContent(
        "Reading and scrolling are not being recorded",
      );

      fireEvent.click(screen.getByTestId("allow-page-access"));

      expect(pageAccess.request).toHaveBeenCalledTimes(1);
      await vi.waitFor(() =>
        expect(screen.queryByTestId("page-access-missing")).not.toBeInTheDocument(),
      );
    });

    it("shows no notice when page access is granted", async () => {
      render(
        <PopupApp
          graph={buildGraph()}
          client={createClient({ active: "E-bike motors" })}
          pageAccess={buildPageAccess()}
        />,
      );

      await screen.findByTestId("session-active");
      await Promise.resolve();

      expect(screen.queryByTestId("page-access-missing")).not.toBeInTheDocument();
    });
  });

  describe("research tree", () => {
    it("subscribes while a session is active, and draws the tree and the unread queue", async () => {
      const graph = buildGraph();

      render(
        <PopupApp
          graph={graph}
          client={createClient({ active: "E-bike motors" })}
          pageAccess={buildPageAccess()}
        />,
      );
      await screen.findByTestId("session-active");

      expect(graph.sent.map(({ type }) => type)).toEqual(["graph.subscribe"]);

      graph.push(
        snapshot(
          node("a"),
          node("b", { parentNodeId: "a", createdAt: 2 }),
          node("c", { openerNodeId: "a", engagement: "unread", tabId: 9, createdAt: 3 }),
        ),
      );

      expect(screen.getByRole("treeitem", { name: /Page B/ })).toHaveAttribute("aria-level", "2");
      expect(screen.getByTestId("unread-count")).toHaveTextContent("Unread: 1");

      fireEvent.click(screen.getByTestId("unread-page"));

      expect(graph.sent.at(-1)).toMatchObject({ type: "tab.focus", payload: { tabId: 9 } });
    });

    it("keeps a collapsed row collapsed when a new snapshot arrives", async () => {
      const graph = buildGraph();

      render(
        <PopupApp
          graph={graph}
          client={createClient({ active: "E-bike motors" })}
          pageAccess={buildPageAccess()}
        />,
      );
      await screen.findByTestId("session-active");
      graph.push(snapshot(node("a"), node("b", { parentNodeId: "a", createdAt: 2 })));

      const tree = screen.getByRole("tree");

      screen.getByRole("treeitem", { name: /Page A/ }).focus();
      fireEvent.keyDown(tree, { key: "ArrowLeft" });
      graph.push(
        snapshot(
          node("a"),
          node("b", { parentNodeId: "a", createdAt: 2 }),
          node("c", { parentNodeId: "a", createdAt: 3 }),
        ),
      );

      expect(screen.getByRole("treeitem", { name: /Page A/ })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      expect(screen.queryByRole("treeitem", { name: /Page C/ })).toBeNull();
    });

    it("neither subscribes nor draws a tree without an active session", async () => {
      const graph = buildGraph();

      render(<PopupApp graph={graph} client={createClient()} pageAccess={buildPageAccess()} />);
      await screen.findByLabelText("Session title");

      expect(graph.sent).toEqual([]);
      expect(screen.queryByRole("tree")).toBeNull();
    });
  });
});
