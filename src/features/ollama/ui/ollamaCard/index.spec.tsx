import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OllamaCard, type OllamaCardClient } from ".";
import { buildRpcMessage } from "@/shared/rpc";

type Listener = (message: unknown) => void;

const createStubClient = () => {
  const listeners = new Set<Listener>();
  const sent: { type: string; payload: unknown }[] = [];
  const client: OllamaCardClient = {
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
      // Snapshot first: a listener may unsubscribe while being notified.
      for (const listener of Array.from(listeners)) {
        listener(message);
      }
    });
  };

  return { client, sent, push };
};

const MODEL = {
  name: "nomic-embed-text:latest",
  family: "embedding" as const,
  isPulled: true,
  isRecommended: true,
  size: "274 MB",
  registeredRef: null,
  isActive: false,
};

const pushState = (push: (message: unknown) => void, state: string, models: unknown[] = []) => {
  push(buildRpcMessage("ollama.state", { state, models }));
};

const renderCard = (
  client: OllamaCardClient,
  props: Partial<Parameters<typeof OllamaCard>[0]> = {},
) => render(<OllamaCard client={client} {...props} />);

afterEach(() => {
  vi.useRealTimers();
});

describe("OllamaCard", () => {
  it("asks for the server's state when it opens", () => {
    const { client, sent } = createStubClient();

    renderCard(client);

    expect(sent).toEqual([expect.objectContaining({ type: "ollama.status" })]);
  });

  it("looks again when told access was granted elsewhere, and not for other changes", () => {
    const { client, sent, push } = createStubClient();
    const count = () => sent.filter(({ type }) => type === "ollama.status").length;

    renderCard(client);
    pushState(push, "notConnected");
    push(buildRpcMessage("data.changed", { topics: ["facts"] }));

    expect(count()).toBe(1);

    push(buildRpcMessage("data.changed", { topics: ["access"] }));

    expect(count()).toBe(2);
  });

  it("says why there is no list while Ollama cannot give one, and looks again when asked", () => {
    const { client, sent, push } = createStubClient();

    renderCard(client);
    pushState(push, "unreachable");

    expect(screen.getByTestId("ollama-not-running").textContent).toContain("Ollama isn't running.");

    fireEvent.click(screen.getByTestId("ollama-recheck"));

    expect(sent.filter(({ type }) => type === "ollama.status")).toHaveLength(2);
  });

  it("walks no one through setup: that is the setup page's", () => {
    const { client, push } = createStubClient();

    renderCard(client);
    pushState(push, "notConnected");

    expect(screen.getByTestId("ollama-not-running").textContent).toContain("AI isn't set up yet.");
    expect(screen.queryByRole("button", { name: /set up|turn on/iu })).toBeNull();
  });

  it("uses another model Ollama has, checking it before it is on", () => {
    const { client, sent, push } = createStubClient();
    const ref = `ollama:nomic-embed-text:latest@${"a".repeat(64)}`;

    renderCard(client);
    pushState(push, "running", [MODEL]);
    fireEvent.click(screen.getByTestId("ollama-use"));
    push(buildRpcMessage("ollama.registered", { name: MODEL.name, ref }));

    expect(sent.at(-1)).toMatchObject({ type: "model.activate", payload: { ref } });
  });

  it("measures extraction time once summaries are on, against the budget", () => {
    const { client, sent, push } = createStubClient();

    renderCard(client);
    pushState(push, "running", [
      { ...MODEL, registeredRef: "ollama:x", isActive: true },
      {
        ...MODEL,
        name: "qwen3:4b",
        family: "text-generation",
        size: "2.5 GB",
        registeredRef: "ollama:y",
        isActive: true,
      },
    ]);

    expect(screen.getByTestId("ollama-summaries-on").textContent).toContain(
      "Page summaries are on, using qwen3:4b.",
    );

    fireEvent.click(screen.getByTestId("ollama-measure-extraction"));

    expect(sent.at(-1)).toMatchObject({ type: "generation.measure" });
    expect(screen.getByTestId("ollama-extraction").textContent).toContain("Extracting facts");

    push(buildRpcMessage("generation.measureProgress", { elapsedMs: 12_400, characters: 1840 }));

    expect(screen.getByTestId("ollama-extraction").textContent).toBe(
      "Extracting facts from a test page… 12 s, 1840 characters written",
    );

    push(
      buildRpcMessage("generation.measured", {
        ref: "ollama:y",
        wordCount: 1492,
        durationMs: 14_250,
        isValid: true,
        correctCount: 15,
        expectedCount: 15,
        meetsBudget: true,
      }),
    );

    const result = screen.getByTestId("ollama-extraction");

    expect(result.textContent).toBe(
      "A comparison table from a 1492-word page in 14.3 s — within the 20 s budget; 15 of 15 values right.",
    );
    expect(result.querySelector("[data-tone]")).toHaveAttribute("data-tone", "ok");
  });

  it("marks a discarded extraction red", () => {
    const { client, push } = createStubClient();

    renderCard(client);
    pushState(push, "running", [
      { ...MODEL, registeredRef: "ollama:x", isActive: true },
      { ...MODEL, name: "qwen3:4b", family: "text-generation", isActive: true },
    ]);
    fireEvent.click(screen.getByTestId("ollama-measure-extraction"));
    push(
      buildRpcMessage("generation.measured", {
        ref: "ollama:y",
        wordCount: 1492,
        durationMs: 9_000,
        isValid: false,
        correctCount: 0,
        expectedCount: 15,
        reason: "The answer was not JSON.",
        meetsBudget: false,
      }),
    );

    expect(screen.getByTestId("ollama-extraction").textContent).toBe(
      "The answer was discarded after 9.0 s: The answer was not JSON.",
    );
  });
});
