import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmbeddingSpacesCard, type EmbeddingSpacesClient } from ".";
import { buildRpcMessage } from "@/shared/rpc";

const createClient = () => {
  const listeners = new Set<(message: unknown) => void>();
  const sent: { type: string; payload: unknown }[] = [];
  const client: EmbeddingSpacesClient = {
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

const space = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  repository: `model-${id}`,
  revision: "r",
  vectorCount: 10,
  approximateBytes: 10 * 384 * 4,
  inUse: false,
  retiredAt: 1,
  removedAt: null,
  ...overrides,
});

describe("EmbeddingSpacesCard", () => {
  it("lists each space with its size and state, and removes a retired one", () => {
    const { client, sent, push } = createClient();

    render(<EmbeddingSpacesCard client={client} />);
    expect(sent.at(-1)).toMatchObject({ type: "spaces.list" });

    push(
      buildRpcMessage("spaces.listed", {
        spaces: [space("new", { inUse: true, retiredAt: null }), space("old")],
      }),
    );

    const [current, retired] = screen.getAllByTestId("space");

    expect(current).toHaveTextContent("in use");
    expect(current).not.toHaveTextContent("Remove");
    expect(retired).toHaveTextContent("15.0 KB");
    expect(retired).toHaveTextContent("retired");

    fireEvent.click(screen.getByTestId("space-remove"));
    expect(sent.at(-1)).toMatchObject({ type: "spaces.remove", payload: { spaceId: "old" } });

    push(buildRpcMessage("spaces.removed", { spaceId: "old", removed: true }));
    expect(sent.at(-1)).toMatchObject({ type: "spaces.list" });
  });

  it("says when nothing has been embedded", () => {
    const { client, push } = createClient();

    render(<EmbeddingSpacesCard client={client} />);
    push(buildRpcMessage("spaces.listed", { spaces: [] }));

    expect(screen.getByTestId("spaces-none")).toBeInTheDocument();
  });
});
