import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecordedApp, type RecordedClient } from ".";
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
  const client: RecordedClient = {
    request: vi.fn((message: RpcMessage<string, unknown>) => {
      sent.push(message.type);

      switch (message.type) {
        case "recorded.read":
          extractionReads += 1;

          if (pages[0]?.facts?.isFinished === false && extractionReads > 2) {
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

  return { client, sent };
};

describe("RecordedApp", () => {
  it("shows the session's pages, and a page's text when asked", async () => {
    const { client } = createClient();

    render(<RecordedApp client={client} />);

    expect(await screen.findByTestId("recorded-title")).toHaveTextContent("E-bike motors");

    fireEvent.click(screen.getByTestId("recorded-show-text"));

    expect(await screen.findByTestId("recorded-text")).toHaveTextContent("Sits at the cranks.");
  });

  it("asks for facts, then reads again until extraction has finished", async () => {
    const { client, sent } = createClient();

    render(<RecordedApp client={client} refreshIntervalMs={10} />);
    fireEvent.click(await screen.findByTestId("recorded-extract-facts"));

    expect(await screen.findByText("Extracting facts…")).toBeInTheDocument();

    expect(await screen.findByText(/3 kept, 1 dropped$/u)).toBeInTheDocument();
    expect(screen.getByTestId("recorded-extract-facts")).toHaveTextContent("Extract facts now");
    expect(screen.getByTestId("recorded-extract-facts")).toBeEnabled();

    const reads = sent.filter((type) => type === "recorded.read").length;

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sent).toContain("facts.extractNow");
    expect(sent.filter((type) => type === "recorded.read")).toHaveLength(reads);
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
});
