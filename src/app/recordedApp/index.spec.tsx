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
};

/** A background holding one session with page A, until something is deleted. */
const createClient = () => {
  let pages = [page];
  let hasSession = true;
  const sent: string[] = [];
  const client: RecordedClient = {
    request: vi.fn((message: RpcMessage<string, unknown>) => {
      sent.push(message.type);

      switch (message.type) {
        case "recorded.read":
          return Promise.resolve(
            buildRpcMessage("recorded.session", {
              session: hasSession
                ? { id: "session-1", title: "E-bike motors", status: "active", pages }
                : null,
            }),
          );
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
