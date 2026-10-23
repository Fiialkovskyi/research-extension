import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SetupApp, type SetupClient } from ".";
import { buildRpcMessage } from "@/shared/rpc";

type Listener = (message: unknown) => void;

const createStubClient = () => {
  const listeners = new Set<Listener>();
  const sent: { type: string; payload: unknown }[] = [];
  const client: SetupClient = {
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

const ENTRY = {
  family: "embedding" as const,
  isPulled: false,
  isRecommended: true,
  size: "274 MB",
  registeredRef: null,
  isActive: false,
};

const RUNNING = buildRpcMessage("ollama.state", {
  state: "running",
  models: [
    { ...ENTRY, name: "nomic-embed-text" },
    { ...ENTRY, name: "qwen3:4b", family: "text-generation", size: "2.5 GB" },
  ],
});

const renderApp = (client: SetupClient, recheckIntervalMs = 3_000) =>
  render(
    <SetupApp
      client={client}
      environment={{ extensionOrigin: "moz-extension://abc", platform: "mac" }}
      recheckIntervalMs={recheckIntervalMs}
    />,
  );

const readStep = () => screen.getByTestId("setup-step").dataset["step"];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SetupApp", () => {
  it("starts setup on opening, follows any run under way, and asks Ollama", () => {
    const { client, sent } = createStubClient();

    renderApp(client);

    expect(sent.map(({ type }) => type)).toEqual([
      "data.subscribe",
      "aiSetup.start",
      "aiSetup.watch",
      "ollama.status",
    ]);
    expect(readStep()).toBe("checking");
  });

  it("moves from getting Ollama to turning AI on by itself, once Ollama answers", () => {
    const { client, push } = createStubClient();

    renderApp(client);
    push(buildRpcMessage("ollama.state", { state: "unreachable", models: [] }));
    expect(readStep()).toBe("getOllama");

    push(RUNNING);
    expect(readStep()).toBe("turnOn");
    expect(screen.getByTestId("setup-size").textContent).toContain("about 2.8 GB");
  });

  it("asks Ollama again every few seconds while waiting for the user", () => {
    vi.useFakeTimers();

    const { client, sent, push } = createStubClient();
    const asked = () => sent.filter(({ type }) => type === "ollama.status").length;

    renderApp(client, 1_000);
    push(buildRpcMessage("ollama.state", { state: "refused", models: [] }));
    expect(readStep()).toBe("allowExtension");

    const before = asked();

    act(() => {
      vi.advanceTimersByTime(2_500);
    });
    expect(asked()).toBe(before + 2);

    push(RUNNING);

    const settled = asked();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(asked()).toBe(settled);
  });

  it("turns AI on with one click, shows its progress, and ends on done", () => {
    const { client, sent, push } = createStubClient();

    renderApp(client);
    push(RUNNING);
    fireEvent.click(screen.getByTestId("setup-turn-on"));

    expect(sent.at(-1)?.type).toBe("aiSetup.turnOn");
    expect(readStep()).toBe("turningOn");

    push(
      buildRpcMessage("aiSetup.turnOnProgress", {
        name: "qwen3:4b",
        family: "text-generation",
        stage: "downloading",
        fraction: 0.5,
        isEmbeddingReady: true,
      }),
    );
    // Reading the status mid-run, once similar pages work, does not end the run.
    push(
      buildRpcMessage("aiSetup.status", {
        isSetUp: true,
        isStarted: true,
        isBannerCollapsed: false,
      }),
    );
    expect(readStep()).toBe("turningOn");
    expect(screen.getByTestId("setup-embedding-ready")).toBeTruthy();

    push(
      buildRpcMessage("aiSetup.turnedOn", {
        isSetUp: true,
        isStarted: true,
        isBannerCollapsed: false,
      }),
    );
    expect(readStep()).toBe("done");
  });

  it("shows a failure on the turn-on step, ready to try again", () => {
    const { client, push } = createStubClient();

    renderApp(client);
    push(RUNNING);
    fireEvent.click(screen.getByTestId("setup-turn-on"));
    push(
      buildRpcMessage("aiSetup.turnOnFailed", {
        name: "qwen3:4b",
        stage: "checking",
        reason: "It did not pass.",
      }),
    );

    expect(readStep()).toBe("turnOn");
    expect(screen.getByRole("alert").textContent).toContain("qwen3:4b");
    expect(screen.getByTestId("setup-turn-on").textContent).toBe("Try again");
  });

  it("picks up a run started from a page since closed", () => {
    const { client, push } = createStubClient();

    renderApp(client);
    push(
      buildRpcMessage("aiSetup.turnOnState", {
        isRunning: true,
        progress: {
          name: "nomic-embed-text",
          family: "embedding",
          stage: "checking",
          fraction: 0.1,
          isEmbeddingReady: false,
        },
      }),
    );

    expect(readStep()).toBe("turningOn");
  });
});
