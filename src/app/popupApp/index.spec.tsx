import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildRpcMessage, type RpcMessage } from "@/shared/rpc";
import { PopupApp, type PopupClient } from "./index";

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

  it("says how many pages the active session has recorded", async () => {
    render(<PopupApp client={createClient({ active: "E-bike motors", pageCount: 2 })} />);

    expect(await screen.findByTestId("session-page-count")).toHaveTextContent("2 pages recorded");
  });

  it("offers the map only while a session is active", async () => {
    render(<PopupApp client={createClient()} />);

    await screen.findByLabelText("Session title");

    expect(screen.queryByTestId("open-map")).not.toBeInTheDocument();
  });

  it("asks the background to open the map", async () => {
    const client = createClient({ active: "E-bike motors" });
    render(<PopupApp client={client} />);

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
    render(<PopupApp client={client} />);

    fireEvent.click(await screen.findByTestId("open-map"));

    expect(await screen.findByTestId("map-error")).toHaveTextContent("No window.");
  });

  it("says a single page in the singular", async () => {
    render(<PopupApp client={createClient({ active: "E-bike motors", pageCount: 1 })} />);

    expect(await screen.findByTestId("session-page-count")).toHaveTextContent("1 page recorded");
  });

  it("names a closed session beside the form, saying a new start ends it", async () => {
    render(<PopupApp client={createClient({ closed: "E-bike motors" })} />);

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
