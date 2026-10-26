import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildRpcMessage } from "@/shared/rpc";
import { PageNoticeToggle, type PageNoticeClient } from ".";

const createClient = () => {
  const listeners = new Set<(message: unknown) => void>();
  const sent: { type: string; payload: unknown }[] = [];
  const client: PageNoticeClient = {
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

describe("PageNoticeToggle", () => {
  it("asks for the setting, and shows nothing until it is answered", () => {
    const { client, sent } = createClient();

    render(<PageNoticeToggle client={client} />);

    expect(sent.map(({ type }) => type)).toEqual(["pageNotice.read"]);
    expect(screen.queryByTestId("page-notice-toggle")).toBeNull();
  });

  it("shows the stored value", () => {
    const { client, push } = createClient();

    render(<PageNoticeToggle client={client} />);
    push(buildRpcMessage("pageNotice.status", { isEnabled: false }));

    expect(screen.getByTestId("page-notice-toggle")).not.toBeChecked();
  });

  it("asks the background to turn it off, and follows the answer", () => {
    const { client, sent, push } = createClient();

    render(<PageNoticeToggle client={client} />);
    push(buildRpcMessage("pageNotice.status", { isEnabled: true }));
    fireEvent.click(screen.getByTestId("page-notice-toggle"));

    expect(sent.at(-1)).toMatchObject({ type: "pageNotice.set", payload: { isEnabled: false } });
    expect(screen.getByTestId("page-notice-toggle")).toBeChecked();

    push(buildRpcMessage("pageNotice.status", { isEnabled: false }));

    expect(screen.getByTestId("page-notice-toggle")).not.toBeChecked();
  });

  it("ignores a message it cannot validate", () => {
    const { client, push } = createClient();

    render(<PageNoticeToggle client={client} />);
    push({ nonsense: true });

    expect(screen.queryByTestId("page-notice-toggle")).toBeNull();
  });
});
