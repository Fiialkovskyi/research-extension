import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecordedApp, type RecordedClient } from ".";
import type { DataTopic } from "@/features/liveData";
import { buildRpcMessage, type RpcMessage } from "@/shared/rpc";

const page = {
  id: "a",
  title: "Mid-drive motors",
  url: "https://example.org/a",
  domain: "example.org",
  kind: "page",
  tabState: "open",
  createdAt: 1,
  signals: {
    activeDwellMs: 1_000,
    maxScroll: 0.5,
    copyEvents: 1,
    focusCount: 1,
    revisitCount: 0,
    quickReturnCount: 0,
  },
  snapshot: { byteLength: 100, truncated: false, capturedAt: 2 },
  metadata: null,
  vectorCount: 1,
  facts: null as { kept: number; dropped: number; isFinished: boolean } | null,
};

/** A background holding one session with page A, until something is deleted. */
const createClient = () => {
  let pages = [page];
  let hasSession = true;
  let extractionReads = 0;
  let entities = [
    {
      id: "neo",
      name: "MacBook Neo 13",
      type: "product",
      factCount: 2,
      pageCount: 1,
      merged: [{ id: "air", name: "MacBook Air 13" }],
    },
  ];
  const sent: string[] = [];
  let listener: ((topics: readonly DataTopic[]) => void) | undefined;
  const client: RecordedClient = {
    watch: (onChange) => {
      listener = onChange;

      return () => {
        listener = undefined;
      };
    },
    request: vi.fn((message: RpcMessage<string, unknown>) => {
      sent.push(message.type);

      switch (message.type) {
        case "recorded.read":
          extractionReads += 1;

          if (pages[0]?.facts?.isFinished === false && extractionReads > 1) {
            pages = [{ ...page, facts: { kept: 3, dropped: 1, isFinished: true } }];
          }

          return Promise.resolve(
            buildRpcMessage("recorded.session", {
              session: hasSession
                ? {
                    id: "session-1",
                    title: "E-bike motors",
                    status: "active",
                    pages,
                    canExtractFacts: true,
                    entities,
                  }
                : null,
            }),
          );
        case "entity.separate":
          entities = [
            { ...entities[0]!, merged: [] },
            {
              id: "air",
              name: "MacBook Air 13",
              type: "product",
              factCount: 1,
              pageCount: 1,
              merged: [],
            },
          ];
          return Promise.resolve(
            buildRpcMessage("entity.separated", { entityId: "air", separated: true }),
          );
        case "facts.extractNow":
          // Extraction starts, then finishes by the second read after it.
          pages = [{ ...page, facts: { kept: 1, dropped: 0, isFinished: false } }];
          extractionReads = 0;
          return Promise.resolve(buildRpcMessage("facts.extractionStarted", { queued: 1 }));
        case "recorded.readText":
          return Promise.resolve(
            buildRpcMessage("recorded.text", { nodeId: "a", text: "Sits at the cranks." }),
          );
        case "node.delete":
          pages = [];
          return Promise.resolve(buildRpcMessage("node.deleted", { nodeId: "a", deleted: true }));
        case "session.delete":
          hasSession = false;
          return Promise.resolve(
            buildRpcMessage("session.deleted", { sessionId: "session-1", deleted: true }),
          );
        default:
          return Promise.reject(new Error(`Unexpected ${message.type}`));
      }
    }),
  };

  /** The background telling the page that data changed. */
  const emit = (topics: readonly DataTopic[]) => {
    act(() => {
      listener?.(topics);
    });
  };

  return { client, sent, emit };
};

describe("RecordedApp", () => {
  it("shows the session's pages, and a page's text when asked", async () => {
    const { client } = createClient();

    render(<RecordedApp client={client} />);

    expect(await screen.findByTestId("recorded-title")).toHaveTextContent("E-bike motors");

    fireEvent.click(screen.getByTestId("recorded-show-text"));

    expect(await screen.findByTestId("recorded-text")).toHaveTextContent("Sits at the cranks.");
  });

  it("asks for facts, then shows them when the background says they changed", async () => {
    const { client, sent, emit } = createClient();

    render(<RecordedApp client={client} />);
    fireEvent.click(await screen.findByTestId("recorded-extract-facts"));

    expect(await screen.findByText("Extracting facts…")).toBeInTheDocument();

    emit(["facts"]);

    expect(await screen.findByText(/3 kept, 1 dropped$/u)).toBeInTheDocument();
    expect(screen.getByTestId("recorded-extract-facts")).toHaveTextContent("Extract facts now");
    expect(screen.getByTestId("recorded-extract-facts")).toBeEnabled();

    const reads = sent.filter((type) => type === "recorded.read").length;

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sent).toContain("facts.extractNow");
    expect(sent.filter((type) => type === "recorded.read")).toHaveLength(reads);
  });

  it("reads again for a change to what it shows, and not for another", async () => {
    const { client, sent, emit } = createClient();

    render(<RecordedApp client={client} />);
    await screen.findByTestId("recorded-title");
    emit(["access"]);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(sent.filter((type) => type === "recorded.read")).toHaveLength(1);

    emit(["snapshots"]);

    await vi.waitFor(() => expect(sent.filter((type) => type === "recorded.read")).toHaveLength(2));
  });

  it("separates a merged name, then reads again", async () => {
    const { client, sent } = createClient();

    render(<RecordedApp client={client} />);
    fireEvent.click(await screen.findByTestId("recorded-separate-entity"));

    await vi.waitFor(() => expect(screen.getAllByTestId("recorded-entity")).toHaveLength(2));
    expect(sent).toEqual(["recorded.read", "entity.separate", "recorded.read"]);
  });

  it("reads again after deleting a page", async () => {
    const { client, sent } = createClient();

    render(<RecordedApp client={client} />);
    fireEvent.click(await screen.findByTestId("recorded-delete-page"));
    fireEvent.click(screen.getByTestId("recorded-delete-page-confirm"));

    expect(await screen.findByText("No pages recorded yet.")).toBeInTheDocument();
    expect(sent).toEqual(["recorded.read", "node.delete", "recorded.read"]);
  });

  it("says there is nothing to show once the session is deleted", async () => {
    const { client } = createClient();

    render(<RecordedApp client={client} />);
    fireEvent.click(await screen.findByTestId("recorded-delete-session"));
    fireEvent.click(screen.getByTestId("recorded-delete-session-confirm"));

    expect(await screen.findByTestId("recorded-empty")).toBeInTheDocument();
  });

  describe("a page pinned to a session", () => {
    afterEach(() => {
      window.history.replaceState(null, "", "/");
    });

    it("reads the session in its address, and names it in the tab", async () => {
      window.history.replaceState(null, "", "/?session=session-2");
      const { client } = createClient();

      render(<RecordedApp client={client} />);
      await screen.findByTestId("recorded-title");

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ type: "recorded.read", payload: { sessionId: "session-2" } }),
      );
      expect(document.title).toContain("What was recorded:");
    });

    it("says the session is gone once it is deleted", async () => {
      window.history.replaceState(null, "", "/?session=session-1");
      const { client } = createClient();

      render(<RecordedApp client={client} />);
      fireEvent.click(await screen.findByTestId("recorded-delete-session"));
      fireEvent.click(screen.getByTestId("recorded-delete-session-confirm"));

      expect(await screen.findByTestId("recorded-empty")).toHaveTextContent("This session is gone");
    });
  });
});
