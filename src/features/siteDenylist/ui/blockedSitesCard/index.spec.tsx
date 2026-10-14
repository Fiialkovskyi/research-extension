import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BlockedSitesCard, type BlockedSitesClient } from ".";
import { buildRpcMessage } from "@/shared/rpc";

const createClient = () => {
  const listeners = new Set<(message: unknown) => void>();
  const sent: { type: string; payload: unknown }[] = [];
  const client: BlockedSitesClient = {
    send: (message) => {
      sent.push(message as { type: string; payload: unknown });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const push = (message: unknown) => {
    act(() => {
      for (const listener of Array.from(listeners)) {
        listener(message);
      }
    });
  };

  return { client, sent, push };
};

const renderCard = (sites: string[] = ["a.example"]) => {
  const handle = createClient();

  render(<BlockedSitesCard client={handle.client} />);
  handle.push(buildRpcMessage("denylist.view", { sites }));

  return handle;
};

describe("BlockedSitesCard", () => {
  it("reads the list, then adds a pasted link by its host", () => {
    const { sent } = renderCard();

    expect(sent[0]).toMatchObject({ type: "denylist.read" });
    fireEvent.change(screen.getByTestId("blocked-site-input"), {
      target: { value: "https://www.myclinic.example/visits" },
    });
    fireEvent.click(screen.getByTestId("blocked-site-add"));

    expect(sent.at(-1)).toMatchObject({
      type: "denylist.save",
      payload: { sites: ["a.example", "myclinic.example"] },
    });
  });

  it("removes a site", () => {
    const { sent } = renderCard(["a.example", "b.example"]);

    fireEvent.click(screen.getByRole("button", { name: "Remove a.example" }));

    expect(sent.at(-1)).toMatchObject({ payload: { sites: ["b.example"] } });
  });

  it("says why input that names no site is not added", () => {
    const { sent } = renderCard();

    fireEvent.change(screen.getByTestId("blocked-site-input"), { target: { value: "not a site" } });
    fireEvent.click(screen.getByTestId("blocked-site-add"));

    expect(screen.getByTestId("blocked-site-hint")).toHaveTextContent("example.org");
    expect(sent.at(-1)).toMatchObject({ type: "denylist.read" });
  });

  it("shows the background's refusal", () => {
    const { push } = renderCard();

    push(buildRpcMessage("denylist.view", { sites: ["a.example"], invalid: "x" }));

    expect(screen.getByTestId("blocked-site-hint")).toBeInTheDocument();
  });
});
