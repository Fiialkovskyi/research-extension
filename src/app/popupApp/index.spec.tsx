import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DataTopic } from "@/features/liveData";
import { buildRpcMessage, type RpcMessage } from "@/shared/rpc";
import { act } from "react";

import { type PageAccess, PopupApp, type PopupClient } from "./index";

interface ClientAnswers {
  /** The active session's title, or `null` for none. */
  active?: string | null;
  /** Pages the active session has recorded. */
  pageCount?: number;
  /** Several active sessions, overriding `active`: their titles, in the order started. */
  sessions?: { title: string; pageCount?: number }[];
  /** The id of the viewed session; the first one when absent. */
  viewedId?: string;
  /** The closed session's title, or `null` for none. */
  closed?: string | null;
  /** The answer to a start; a rejection when it is an `Error`. */
  start?: unknown;
  /** The answer to opening the map. */
  map?: unknown;
  /** Whether an embedding model is on; set up unless a test says otherwise. */
  isAiSetUp?: boolean;
  /** What the local AI is doing; ready with nothing done unless a test says otherwise. */
  activity?: unknown;
}

/** A background that reports `active` when asked, and answers a start with `start`. */
const createClient = ({
  active = null,
  pageCount = 0,
  sessions,
  viewedId,
  closed = null,
  start,
  map = buildRpcMessage("map.opened", {}),
  isAiSetUp = true,
  activity = { kind: "ready", totals: {}, failed: 0 },
}: ClientAnswers = {}): PopupClient => {
  /** The title of a session a start has just made, which the next read lists. */
  let started: string | undefined;
  let viewed = viewedId;
  const listed = () =>
    (sessions ?? (active === null ? [] : [{ title: active, pageCount }])).map((session, index) => ({
      id: `session-${index + 1}`,
      title: session.title,
      groupId: 42 + index,
      pageCount: session.pageCount ?? 0,
    }));

  return {
    request: vi.fn((message: RpcMessage<string, unknown>) => {
      if (message.type === "aiActivity.read") {
        return Promise.resolve(buildRpcMessage("aiActivity.state", activity));
      }

      if (message.type === "aiActivity.runNow") {
        return Promise.resolve(buildRpcMessage("aiActivity.runStarted", { marked: 1 }));
      }

      if (message.type === "aiSetup.read" || message.type === "aiSetup.collapseBanner") {
        return Promise.resolve(
          buildRpcMessage("aiSetup.status", {
            isSetUp: isAiSetUp,
            isStarted: isAiSetUp,
            isBannerCollapsed:
              message.type === "aiSetup.collapseBanner" &&
              (message.payload as { isCollapsed: boolean }).isCollapsed,
          }),
        );
      }

      if (message.type === "aiSetup.open") {
        return Promise.resolve(buildRpcMessage("aiSetup.opened", {}));
      }

      if (message.type === "map.open") {
        return Promise.resolve(map);
      }

      if (message.type === "session.getActive") {
        const all = [
          ...listed(),
          ...(started === undefined
            ? []
            : [{ id: "session-started", title: started, groupId: 99, pageCount: 0 }]),
        ];

        return Promise.resolve(
          buildRpcMessage("session.active", {
            sessions: all,
            viewedId: started === undefined ? (viewed ?? all[0]?.id ?? null) : "session-started",
          }),
        );
      }

      if (message.type === "session.view") {
        viewed = (message.payload as { sessionId: string }).sessionId;

        return Promise.resolve(buildRpcMessage("session.viewed", { viewedId: viewed }));
      }

      if (message.type === "library.list") {
        return Promise.resolve(
          buildRpcMessage("library.listed", {
            sessions:
              closed === null
                ? []
                : [
                    {
                      id: "session-0",
                      title: closed,
                      savedAt: 1,
                      pageCount: 0,
                      lastPosition: null,
                    },
                  ],
          }),
        );
      }

      if (message.type === "tabGroup.create" && !(start instanceof Error)) {
        const response = start as { type?: string; payload?: { title?: string } } | undefined;

        if (response?.type === "tabGroup.created") {
          started = response.payload?.title;
        }
      }

      return start instanceof Error ? Promise.reject(start) : Promise.resolve(start);
    }),
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

/** A background with one saved session, and an active one until saved. */
const createLibraryClient = ({ isActive = true, lastPosition = undefined as unknown }) => {
  let active = isActive;
  const client: PopupClient = {
    request: vi.fn((message: RpcMessage<string, unknown>) => {
      switch (message.type) {
        case "session.getActive":
          return Promise.resolve(
            buildRpcMessage("session.active", {
              sessions: active
                ? [
                    {
                      id: "session-1",
                      title: "E-bike motors",
                      groupId: 42,
                      pageCount: 2,
                      ...(lastPosition === undefined ? {} : { lastPosition }),
                    },
                  ]
                : [],
              viewedId: active ? "session-1" : null,
            }),
          );
        case "library.list":
          return Promise.resolve(
            buildRpcMessage("library.listed", {
              sessions: active
                ? []
                : [
                    {
                      id: "session-1",
                      title: "E-bike motors",
                      savedAt: 1,
                      pageCount: 2,
                      lastPosition: { title: "Page B", readFraction: 0.4 },
                    },
                  ],
            }),
          );
        case "session.resume":
          active = true;
          return Promise.resolve(
            buildRpcMessage("session.resumed", {
              sessionId: "session-1",
              title: "E-bike motors",
            }),
          );
        default:
          return Promise.resolve(buildRpcMessage("map.opened", {}));
      }
    }),
  };

  return client;
};

describe("PopupApp", () => {
  it("shows no greeting: the panel opens on the session picker", async () => {
    render(<PopupApp client={createClient()} pageAccess={buildPageAccess()} />);

    expect(screen.getByTestId("popup-panel")).toBeInTheDocument();
    expect(screen.queryByText("Hello World")).toBeNull();
    expect(await screen.findByLabelText("Session title")).toBeInTheDocument();
  });

  it("offers the title form when no session is active", async () => {
    render(<PopupApp client={createClient()} pageAccess={buildPageAccess()} />);

    expect(await screen.findByLabelText("Session title")).toBeInTheDocument();
    expect(screen.queryByTestId("session-active")).not.toBeInTheDocument();
  });

  it("lists the active session in the picker, and still offers to start another", async () => {
    render(
      <PopupApp
        client={createClient({ active: "E-bike motors" })}
        pageAccess={buildPageAccess()}
      />,
    );

    await screen.findByTestId("session-active");

    expect(screen.getByTestId("session-select")).toHaveValue("session-1");
    expect(screen.getByTestId("session-new")).toBeEnabled();
  });

  it("shows the active session instead of the form", async () => {
    render(
      <PopupApp
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
        client={createClient({ active: "E-bike motors", pageCount: 2 })}
        pageAccess={buildPageAccess()}
      />,
    );

    expect(await screen.findByTestId("session-page-count")).toHaveTextContent("2 pages recorded");
  });

  it("offers the map only while a session is active", async () => {
    render(<PopupApp client={createClient()} pageAccess={buildPageAccess()} />);

    await screen.findByLabelText("Session title");

    expect(screen.queryByTestId("open-map")).not.toBeInTheDocument();
  });

  it("asks the background to open the map", async () => {
    const client = createClient({ active: "E-bike motors" });
    render(<PopupApp client={client} pageAccess={buildPageAccess()} />);

    fireEvent.click(await screen.findByTestId("open-map"));

    expect(client.request).toHaveBeenCalledWith(expect.objectContaining({ type: "map.open" }));
    // The session, whether AI is set up, what it is doing, the library, and the map.
    await vi.waitFor(() => expect(client.request).toHaveBeenCalledTimes(5));
    expect(screen.queryByTestId("map-error")).not.toBeInTheDocument();
  });

  it("says why the map could not be opened", async () => {
    const client = createClient({
      active: "E-bike motors",
      map: buildRpcMessage("rpc.failed", { requestType: "map.open", reason: "No window." }),
    });
    render(<PopupApp client={client} pageAccess={buildPageAccess()} />);

    fireEvent.click(await screen.findByTestId("open-map"));

    expect(await screen.findByTestId("map-error")).toHaveTextContent("No window.");
  });

  it("says a single page in the singular", async () => {
    render(
      <PopupApp
        client={createClient({ active: "E-bike motors", pageCount: 1 })}
        pageAccess={buildPageAccess()}
      />,
    );

    expect(await screen.findByTestId("session-page-count")).toHaveTextContent("1 page recorded");
  });

  it("lists a session whose group is gone among the saved ones, ready to resume", async () => {
    render(
      <PopupApp
        client={createClient({ closed: "E-bike motors" })}
        pageAccess={buildPageAccess()}
      />,
    );

    expect(await screen.findByTestId("resume-session")).toBeInTheDocument();
    expect(screen.getByTestId("session-select")).toHaveValue("session-0");
    expect(screen.queryByTestId("session-active")).toBeNull();
  });

  describe("several active sessions", () => {
    const TWO = {
      sessions: [
        { title: "E-bike motors", pageCount: 2 },
        { title: "Batteries", pageCount: 5 },
      ],
    };

    it("shows the viewed one, with its pages, among all of them", async () => {
      render(
        <PopupApp
          client={createClient({ ...TWO, viewedId: "session-2" })}
          pageAccess={buildPageAccess()}
        />,
      );

      expect(await screen.findByTestId("session-active")).toHaveTextContent("Batteries");
      expect(screen.getByTestId("session-page-count")).toHaveTextContent("5 pages recorded");
      expect(screen.getByTestId("session-select")).toHaveValue("session-2");
      expect(screen.getByRole("option", { name: "E-bike motors · 2 pages" })).toBeInTheDocument();
    });

    it("only asks the background to view the session that is chosen", async () => {
      const client = createClient(TWO);
      render(<PopupApp client={client} pageAccess={buildPageAccess()} />);
      await screen.findByTestId("session-active");

      fireEvent.change(screen.getByTestId("session-select"), { target: { value: "session-2" } });

      expect(await screen.findByTestId("session-active")).toHaveTextContent("Batteries");
      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ type: "session.view", payload: { sessionId: "session-2" } }),
      );
      const types = vi.mocked(client.request).mock.calls.map(([message]) => message.type);

      expect(types).not.toContain("session.resume");
      expect(types).not.toContain("tabGroup.create");
    });

    it("opens the map, what was recorded and the summaries for the viewed session", async () => {
      const client = createClient({ ...TWO, viewedId: "session-2" });
      render(<PopupApp client={client} pageAccess={buildPageAccess()} />);

      fireEvent.click(await screen.findByTestId("open-map"));
      fireEvent.click(screen.getByTestId("open-recorded"));
      fireEvent.click(screen.getByTestId("open-summaries"));

      for (const type of ["map.open", "recorded.open", "summaries.open"]) {
        expect(client.request).toHaveBeenCalledWith(
          expect.objectContaining({ type, payload: { sessionId: "session-2" } }),
        );
      }
    });
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
    render(<PopupApp client={client} pageAccess={buildPageAccess()} />);

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
    render(<PopupApp client={createClient({ start })} pageAccess={buildPageAccess()} />);

    await startSession("Motors");

    expect(await screen.findByRole("alert")).toHaveTextContent("bad title");
  });

  it("shows a failure when the background cannot be reached", async () => {
    render(
      <PopupApp
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
        client={createClient({ start: "not an envelope" })}
        pageAccess={buildPageAccess()}
      />,
    );

    await startSession("Motors");

    expect(await screen.findByRole("alert")).toHaveTextContent(/envelope/);
  });

  it("still offers the form when the active session cannot be read", async () => {
    const client: PopupClient = { request: vi.fn().mockRejectedValue(new Error("no receiver")) };
    render(<PopupApp client={client} pageAccess={buildPageAccess()} />);

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
        return Promise.resolve(buildRpcMessage("session.active", { sessions: [], viewedId: null }));
      });
      render(<PopupApp client={client} pageAccess={pageAccess} />);
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

      expect(calls.slice(0, 3)).toEqual(["session.getActive", "permission", "tabGroup.create"]);
    });

    it("does not ask again when page access is already granted", async () => {
      const pageAccess = buildPageAccess();

      render(<PopupApp client={createClient()} pageAccess={pageAccess} />);
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

      render(<PopupApp client={client} pageAccess={pageAccess} />);
      await startSession("E-bike motors");

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ type: "tabGroup.create" }),
      );
    });

    it("says what is not recorded during a session without page access, and asks again", async () => {
      const pageAccess = buildPageAccess({ isGranted: false });

      render(
        <PopupApp client={createClient({ active: "E-bike motors" })} pageAccess={pageAccess} />,
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
          client={createClient({ active: "E-bike motors" })}
          pageAccess={buildPageAccess()}
        />,
      );

      await screen.findByTestId("session-active");
      await Promise.resolve();

      expect(screen.queryByTestId("page-access-missing")).not.toBeInTheDocument();
    });
  });

  describe("what was recorded", () => {
    it("is offered during a session, and opens the page for it", async () => {
      const client = createClient({ active: "E-bike motors" });

      render(<PopupApp client={client} pageAccess={buildPageAccess()} />);
      fireEvent.click(await screen.findByTestId("open-recorded"));

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ type: "recorded.open", payload: { sessionId: "session-1" } }),
      );
    });

    it("is not offered without a session", async () => {
      render(<PopupApp client={createClient()} pageAccess={buildPageAccess()} />);
      await screen.findByLabelText("Session title");

      expect(screen.queryByTestId("open-recorded")).toBeNull();
    });
  });

  describe("summaries", () => {
    it("are offered beside what was recorded, during a session", async () => {
      const client = createClient({ active: "E-bike motors" });

      render(<PopupApp client={client} pageAccess={buildPageAccess()} />);
      expect(await screen.findByTestId("open-summaries")).toHaveTextContent("Synthesis");
      fireEvent.click(screen.getByTestId("open-summaries"));

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ type: "summaries.open", payload: { sessionId: "session-1" } }),
      );
    });

    it("are not offered without a session", async () => {
      render(<PopupApp client={createClient()} pageAccess={buildPageAccess()} />);
      await screen.findByLabelText("Session title");

      expect(screen.queryByTestId("open-summaries")).toBeNull();
    });
  });

  describe("saving and resuming", () => {
    it("offers no control to save: the session is saved as the user goes", async () => {
      render(<PopupApp client={createLibraryClient({})} pageAccess={buildPageAccess()} />);

      expect(await screen.findByTestId("session-active")).toBeInTheDocument();
      expect(screen.queryByTestId("save-session")).toBeNull();
    });

    it("resumes a saved session and shows it as active", async () => {
      const client = createLibraryClient({ isActive: false });

      render(<PopupApp client={client} pageAccess={buildPageAccess()} />);
      fireEvent.click(await screen.findByTestId("resume-session"));

      expect(await screen.findByTestId("session-active")).toHaveTextContent("E-bike motors");
      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ type: "session.resume", payload: { sessionId: "session-1" } }),
      );
    });

    it("says where the user left off in a resumed session", async () => {
      render(
        <PopupApp
          client={createLibraryClient({ lastPosition: { title: "Page B", readFraction: 0.4 } })}
          pageAccess={buildPageAccess()}
        />,
      );

      expect(await screen.findByTestId("left-off")).toHaveTextContent(
        "You left off at Page B (40% read)",
      );
    });
  });

  describe("continuing a saved session", () => {
    it("offers it, and continues it on request", async () => {
      let suggestion: unknown = { sessionId: "old", title: "E-bike motors" };
      const client: PopupClient = {
        request: vi.fn((message: RpcMessage<string, unknown>) => {
          if (message.type === "session.reattach") {
            suggestion = undefined;
            return Promise.resolve(
              buildRpcMessage("session.reattached", { sessionId: "old", title: "E-bike motors" }),
            );
          }

          return Promise.resolve(
            buildRpcMessage("session.active", {
              sessions: [
                {
                  id: suggestion === undefined ? "old" : "new",
                  title: suggestion === undefined ? "E-bike motors" : "Mid-drive",
                  groupId: 42,
                  pageCount: 1,
                  ...(suggestion === undefined ? {} : { reattachSuggestion: suggestion }),
                },
              ],
              viewedId: suggestion === undefined ? "old" : "new",
            }),
          );
        }),
      };

      render(<PopupApp client={client} pageAccess={buildPageAccess()} />);

      expect(await screen.findByTestId("reattach-offer")).toHaveTextContent("E-bike motors");

      fireEvent.click(screen.getByTestId("reattach-continue"));

      expect(await screen.findByTestId("session-active")).toHaveTextContent("E-bike motors");
      expect(screen.queryByTestId("reattach-offer")).toBeNull();
      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ type: "session.reattach", payload: { savedSessionId: "old" } }),
      );
    });

    it("keeps the sessions apart on request, and stops offering", async () => {
      let isOffered = true;
      const client: PopupClient = {
        request: vi.fn((message: RpcMessage<string, unknown>) => {
          if (message.type === "session.keepSeparate") {
            isOffered = false;
            return Promise.resolve(buildRpcMessage("session.keptSeparate", {}));
          }

          return Promise.resolve(
            buildRpcMessage("session.active", {
              sessions: [
                {
                  id: "new",
                  title: "Mid-drive",
                  groupId: 42,
                  pageCount: 1,
                  ...(isOffered
                    ? { reattachSuggestion: { sessionId: "old", title: "E-bike motors" } }
                    : {}),
                },
              ],
              viewedId: "new",
            }),
          );
        }),
      };

      render(<PopupApp client={client} pageAccess={buildPageAccess()} />);
      fireEvent.click(await screen.findByTestId("reattach-keep-separate"));

      await vi.waitFor(() => expect(screen.queryByTestId("reattach-offer")).toBeNull());
      expect(screen.getByTestId("session-active")).toHaveTextContent("Mid-drive");
    });
  });
});

describe("PopupApp's way to settings", () => {
  it("links to settings with or without a session", async () => {
    const openSettings = vi.fn();

    render(
      <PopupApp
        client={createClient()}
        pageAccess={buildPageAccess()}
        openSettings={openSettings}
      />,
    );

    fireEvent.click(await screen.findByTestId("open-settings"));

    expect(openSettings).toHaveBeenCalledOnce();
  });
});

describe("PopupApp while local AI waits for Ollama", () => {
  it("says so once, in the strip, and asks nothing of Ollama itself", async () => {
    const client = createClient({
      active: "E-bike motors",
      activity: { kind: "paused", waiting: 2, failed: 0 },
    });

    render(<PopupApp client={client} pageAccess={buildPageAccess()} />);

    expect(await screen.findByTestId("activity-text")).toHaveTextContent(
      "Local AI isn't answering · 2 waiting",
    );
    await screen.findByTestId("session-active");

    expect(screen.getAllByText(/isn't (answering|running)/u)).toHaveLength(1);
    expect(client.request).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "ollama.health" }),
    );
  });
});

describe("PopupApp while AI is not set up", () => {
  it("leads to the setup page from a banner above everything else", async () => {
    const client = createClient({ isAiSetUp: false });

    render(<PopupApp client={client} pageAccess={buildPageAccess()} />);

    const banner = await screen.findByTestId("setup-banner");

    expect(screen.getByTestId("popup-panel").firstElementChild).toBe(banner);

    fireEvent.click(screen.getByTestId("setup-banner-action"));

    expect(client.request).toHaveBeenCalledWith(expect.objectContaining({ type: "aiSetup.open" }));
  });

  it("asks the background to remember a folded banner", async () => {
    const client = createClient({ isAiSetUp: false });

    render(<PopupApp client={client} pageAccess={buildPageAccess()} />);
    fireEvent.click(await screen.findByTestId("setup-banner-toggle"));

    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({ type: "aiSetup.collapseBanner", payload: { isCollapsed: true } }),
    );
    expect(screen.getByTestId("setup-banner").dataset["collapsed"]).toBe("true");
  });

  it("still starts a session", async () => {
    const client = createClient({
      isAiSetUp: false,
      start: buildRpcMessage("tabGroup.created", {
        groupId: 42,
        tabId: 7,
        title: "E-bike motors",
        color: "blue",
      }),
    });

    render(<PopupApp client={client} pageAccess={buildPageAccess()} />);
    fireEvent.change(await screen.findByLabelText("Session title"), {
      target: { value: "E-bike motors" },
    });
    fireEvent.submit(screen.getByLabelText("Session title").closest("form")!);

    expect(await screen.findByTestId("session-active")).toHaveTextContent("E-bike motors");
  });

  it("shows no banner once AI is set up", async () => {
    render(<PopupApp client={createClient()} pageAccess={buildPageAccess()} />);

    await screen.findByLabelText("Session title");

    expect(screen.queryByTestId("setup-banner")).not.toBeInTheDocument();
  });
});

/** A data-change feed the test announces topics on, as the background's port would. */
const buildWatch = () => {
  const listeners = new Set<(topics: readonly DataTopic[]) => void>();

  return {
    watch: (onChange: (topics: readonly DataTopic[]) => void) => {
      listeners.add(onChange);

      return () => {
        listeners.delete(onChange);
      };
    },
    announce: (...topics: DataTopic[]) => {
      act(() => {
        for (const listener of listeners) {
          listener(topics);
        }
      });
    },
  };
};

const working = (settled: number) => ({
  kind: "working",
  label: "Extracting facts",
  settled,
  total: 12,
  failed: 0,
});

describe("PopupApp showing what the local AI is doing", () => {
  it("shows the strip under the header once AI is set up", async () => {
    render(
      <PopupApp client={createClient({ activity: working(3) })} pageAccess={buildPageAccess()} />,
    );

    expect(await screen.findByTestId("activity-text")).toHaveTextContent(
      "Extracting facts · 3 of 12",
    );
  });

  it("shows the banner and no strip while AI is not set up", async () => {
    render(<PopupApp client={createClient({ isAiSetUp: false })} pageAccess={buildPageAccess()} />);

    await screen.findByTestId("setup-banner");

    expect(screen.queryByTestId("activity-strip")).not.toBeInTheDocument();
  });

  it("swaps the banner for the strip when a model change sets AI up", async () => {
    const feed = buildWatch();
    let isAiSetUp = false;
    const base = createClient();
    const client: PopupClient = {
      watch: feed.watch,
      request: (message) =>
        message.type === "aiSetup.read"
          ? Promise.resolve(
              buildRpcMessage("aiSetup.status", {
                isSetUp: isAiSetUp,
                isStarted: true,
                isBannerCollapsed: false,
              }),
            )
          : base.request(message),
    };

    render(<PopupApp client={client} pageAccess={buildPageAccess()} />);
    await screen.findByTestId("setup-banner");

    isAiSetUp = true;
    feed.announce("models");

    expect(await screen.findByTestId("activity-strip")).toBeInTheDocument();
    expect(screen.queryByTestId("setup-banner")).not.toBeInTheDocument();
  });

  it("follows the queue: a settled job moves the count on", async () => {
    const feed = buildWatch();
    let settled = 3;
    const base = createClient();
    const client: PopupClient = {
      watch: feed.watch,
      request: (message) =>
        message.type === "aiActivity.read"
          ? Promise.resolve(buildRpcMessage("aiActivity.state", working(settled)))
          : base.request(message),
    };

    render(<PopupApp client={client} pageAccess={buildPageAccess()} />);
    expect(await screen.findByTestId("activity-text")).toHaveTextContent("3 of 12");

    settled = 4;
    feed.announce("jobs");

    await vi.waitFor(() =>
      expect(screen.getByTestId("activity-text")).toHaveTextContent("4 of 12"),
    );
  });

  it("does not read again for changes it does not show", async () => {
    const feed = buildWatch();
    const client = { ...createClient(), watch: feed.watch };

    render(<PopupApp client={client} pageAccess={buildPageAccess()} />);
    await screen.findByTestId("activity-strip");

    const readsBefore = vi
      .mocked(client.request)
      .mock.calls.filter(([message]) => message.type === "aiActivity.read").length;

    feed.announce("facts");

    expect(
      vi
        .mocked(client.request)
        .mock.calls.filter(([message]) => message.type === "aiActivity.read"),
    ).toHaveLength(readsBefore);
  });

  it("opens the setup page from the paused strip", async () => {
    const client = createClient({ activity: { kind: "paused", waiting: 5, failed: 0 } });

    render(<PopupApp client={client} pageAccess={buildPageAccess()} />);
    fireEvent.click(await screen.findByTestId("activity-open-setup"));

    expect(client.request).toHaveBeenCalledWith(expect.objectContaining({ type: "aiSetup.open" }));
  });

  it("asks the background to run the held work once when run now is pressed", async () => {
    const client = createClient({ activity: { kind: "waiting", waiting: 3, failed: 0 } });

    render(<PopupApp client={client} pageAccess={buildPageAccess()} />);
    fireEvent.click(await screen.findByTestId("activity-run-now"));
    fireEvent.click(screen.getByTestId("activity-run-now"));

    expect(
      vi.mocked(client.request).mock.calls.filter(([m]) => m.type === "aiActivity.runNow"),
    ).toHaveLength(1);
    await vi.waitFor(() => expect(screen.getByTestId("activity-run-now")).toBeEnabled());
  });
});
