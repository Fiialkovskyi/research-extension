import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildRpcMessage } from "@/shared/rpc";
import { PopupApp, type PopupClient } from "./index";

const createClient = (answer: unknown): PopupClient => ({
  request: vi.fn().mockResolvedValue(answer),
});

const startSession = (title: string) => {
  fireEvent.change(screen.getByLabelText("Session title"), { target: { value: title } });
  fireEvent.click(screen.getByTestId("group-submit"));
};

describe("PopupApp", () => {
  it("shows the greeting inside the popup panel", () => {
    render(<PopupApp client={createClient(undefined)} />);

    const panel = screen.getByTestId("popup-panel");

    expect(panel).toBeInTheDocument();
    expect(panel).toContainElement(screen.getByText("Hello World"));
  });

  it("asks the background to start a session with the entered title", async () => {
    const client = createClient(
      buildRpcMessage("tabGroup.created", { groupId: 1, tabId: 2, title: "Motors", color: "blue" }),
    );
    render(<PopupApp client={client} />);

    startSession("Motors");

    expect(await screen.findByTestId("group-started")).toHaveTextContent("Motors");
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({ type: "tabGroup.create", payload: { title: "Motors" } }),
    );
  });

  it("shows why the session could not be started", async () => {
    render(
      <PopupApp client={createClient(buildRpcMessage("tabGroup.failed", { reason: "refused" }))} />,
    );

    startSession("Motors");

    expect(await screen.findByRole("alert")).toHaveTextContent("refused");
  });

  it("shows a protocol refusal as a failure too", async () => {
    const answer = buildRpcMessage("rpc.refused", {
      rejection: "invalid-payload",
      reason: "bad title",
    });
    render(<PopupApp client={createClient(answer)} />);

    startSession("Motors");

    expect(await screen.findByRole("alert")).toHaveTextContent("bad title");
  });

  it("shows a failure when the background cannot be reached", async () => {
    const client: PopupClient = { request: vi.fn().mockRejectedValue(new Error("no receiver")) };
    render(<PopupApp client={client} />);

    startSession("Motors");

    expect(await screen.findByRole("alert")).toHaveTextContent("no receiver");
  });

  it("shows a reply it cannot understand as a failure", async () => {
    render(<PopupApp client={createClient("not an envelope")} />);

    startSession("Motors");

    expect(await screen.findByRole("alert")).toHaveTextContent(/envelope/);
  });
});
