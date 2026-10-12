import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildRpcMessage, type RpcMessage } from "@/shared/rpc";
import { PopupApp, type PopupClient } from "./index";

interface ClientAnswers {
  /** The active session's title, or `null` for none. */
  active?: string | null;
  /** The answer to a start; a rejection when it is an `Error`. */
  start?: unknown;
}

/** A background that reports `active` when asked, and answers a start with `start`. */
const createClient = ({ active = null, start }: ClientAnswers = {}): PopupClient => ({
  request: vi.fn((message: RpcMessage<string, unknown>) => {
    if (message.type === "session.getActive") {
      return Promise.resolve(
        buildRpcMessage("session.active", {
          session: active === null ? null : { id: "session-1", title: active, groupId: 42 },
        }),
      );
    }

    return start instanceof Error ? Promise.reject(start) : Promise.resolve(start);
  }),
});

const startSession = async (title: string) => {
  fireEvent.change(await screen.findByLabelText("Session title"), { target: { value: title } });
  fireEvent.click(screen.getByTestId("group-submit"));
};

describe("PopupApp", () => {
  it("shows the greeting inside the popup panel", () => {
    render(<PopupApp client={createClient()} />);

    const panel = screen.getByTestId("popup-panel");

    expect(panel).toBeInTheDocument();
    expect(panel).toContainElement(screen.getByText("Hello World"));
  });

  it("offers the title form when no session is active", async () => {
    render(<PopupApp client={createClient()} />);

    expect(await screen.findByLabelText("Session title")).toBeInTheDocument();
    expect(screen.queryByTestId("session-active")).not.toBeInTheDocument();
  });

  it("shows the active session instead of the form", async () => {
    render(<PopupApp client={createClient({ active: "E-bike motors" })} />);

    expect(await screen.findByTestId("session-active")).toHaveTextContent("E-bike motors");
    expect(screen.queryByLabelText("Session title")).not.toBeInTheDocument();
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
    render(<PopupApp client={client} />);

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
    render(<PopupApp client={createClient({ start })} />);

    await startSession("Motors");

    expect(await screen.findByRole("alert")).toHaveTextContent("bad title");
  });

  it("shows a failure when the background cannot be reached", async () => {
    render(<PopupApp client={createClient({ start: new Error("no receiver") })} />);

    await startSession("Motors");

    expect(await screen.findByRole("alert")).toHaveTextContent("no receiver");
  });

  it("shows a reply it cannot understand as a failure", async () => {
    render(<PopupApp client={createClient({ start: "not an envelope" })} />);

    await startSession("Motors");

    expect(await screen.findByRole("alert")).toHaveTextContent(/envelope/);
  });

  it("still offers the form when the active session cannot be read", async () => {
    const client: PopupClient = { request: vi.fn().mockRejectedValue(new Error("no receiver")) };
    render(<PopupApp client={client} />);

    expect(await screen.findByLabelText("Session title")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("no receiver");
  });
});
