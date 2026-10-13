import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OllamaCard, type OllamaCardClient } from ".";
import { buildRpcMessage } from "@/shared/rpc";

type Listener = (message: unknown) => void;

const ORIGIN = "moz-extension://0f8e7a1c-1111-4222-8333-944455556666";

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
) =>
  render(
    <OllamaCard
      client={client}
      requestAccess={vi.fn()}
      extensionOrigin={ORIGIN}
      platform="mac"
      {...props}
    />,
  );

const getStatus = (testId: string) => screen.getByTestId(testId).getAttribute("data-status");

afterEach(() => {
  vi.useRealTimers();
});

describe("OllamaCard", () => {
  it("asks for the server's state when it opens", () => {
    const { client, sent } = createStubClient();

    renderCard(client);

    expect(sent).toEqual([expect.objectContaining({ type: "ollama.status" })]);
  });

  it("is optional and closed until the user has connected", () => {
    const { client, push } = createStubClient();

    renderCard(client);
    pushState(push, "notConnected");

    const section = screen.getByTestId("ollama-card");

    expect(section.hasAttribute("open")).toBe(false);
    expect(section.textContent).toContain("(optional)");
    expect(section.textContent).toContain("works without it");

    pushState(push, "unreachable");

    expect(section.hasAttribute("open")).toBe(true);
  });

  it("sets up with the permission request inside the click, then looks again", async () => {
    const { client, sent, push } = createStubClient();
    const requestAccess = vi.fn(() => Promise.resolve(true));

    renderCard(client, { requestAccess });
    pushState(push, "notConnected");
    fireEvent.click(screen.getByTestId("ollama-connect"));

    expect(requestAccess).toHaveBeenCalledOnce();
    await vi.waitFor(() =>
      expect(sent.filter(({ type }) => type === "ollama.status")).toHaveLength(2),
    );
  });

  it("starts the checklist at installing and opening Ollama, and checks again by itself", () => {
    vi.useFakeTimers();

    const { client, sent, push } = createStubClient();

    renderCard(client, { recheckIntervalMs: 1_000 });
    pushState(push, "unreachable");

    expect(getStatus("ollama-step-install")).toBe("current");
    expect(getStatus("ollama-step-open")).toBe("current");
    expect(getStatus("ollama-step-turn-on")).toBe("pending");
    expect(screen.queryByTestId("ollama-step-allow")).toBeNull();
    expect(screen.getAllByRole("img", { name: "To do now" })).toHaveLength(2);
    expect(screen.getAllByRole("img", { name: "Later" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Download Ollama" }).getAttribute("href")).toBe(
      "https://ollama.com/download",
    );

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(sent.filter(({ type }) => type === "ollama.status")).toHaveLength(3);
  });

  it("asks to allow this extension, naming only its own origin, when Ollama refuses it", () => {
    const { client, push } = createStubClient();

    renderCard(client);
    pushState(push, "refused");

    expect(getStatus("ollama-step-install")).toBe("done");
    expect(getStatus("ollama-step-open")).toBe("done");
    expect(getStatus("ollama-step-allow")).toBe("current");
    expect(screen.getAllByRole("img", { name: "Done" })).toHaveLength(2);

    const command = screen.getByTestId("ollama-allow-command").textContent ?? "";

    expect(command).toContain(ORIGIN);
    expect(command).not.toContain("moz-extension://*");
    expect(screen.getByTestId("ollama-step-allow").textContent).toContain("Terminal");
  });

  it("writes the allow command for the user's operating system", () => {
    const { client, push } = createStubClient();

    renderCard(client, { platform: "win" });
    pushState(push, "refused");

    expect(screen.getByTestId("ollama-allow-command").textContent).toBe(
      `setx OLLAMA_ORIGINS "${ORIGIN}"`,
    );
    expect(screen.getByTestId("ollama-step-allow").textContent).toContain("open it again");
  });

  it("turns local AI on in one action, showing one progress", () => {
    const { client, sent, push } = createStubClient();

    renderCard(client);
    pushState(push, "running", [{ ...MODEL, name: "nomic-embed-text", isPulled: false }]);

    expect(getStatus("ollama-step-turn-on")).toBe("current");

    fireEvent.click(screen.getByTestId("ollama-turn-on"));

    expect(sent.at(-1)).toMatchObject({
      type: "ollama.enable",
      payload: { name: "nomic-embed-text" },
    });

    push(
      buildRpcMessage("ollama.enableProgress", {
        name: "nomic-embed-text",
        stage: "downloading",
        percent: 40,
      }),
    );

    expect(screen.getByTestId("ollama-enable-progress").textContent).toBe(
      "Downloading the model 40%",
    );

    push(buildRpcMessage("ollama.enableProgress", { name: "nomic-embed-text", stage: "checking" }));

    expect(screen.getByTestId("ollama-enable-progress").textContent).toBe(
      "Checking the model's quality…",
    );

    push(buildRpcMessage("ollama.enabled", { name: "nomic-embed-text", ref: "ollama:x" }));
    pushState(push, "running", [{ ...MODEL, registeredRef: "ollama:x", isActive: true }]);

    expect(screen.getByTestId("ollama-on").textContent).toContain("Local AI is on");
    expect(screen.getByTestId("ollama-on").querySelector("[data-tone]")).toHaveAttribute(
      "data-tone",
      "ok",
    );
    expect(screen.queryByTestId("ollama-checklist")).toBeNull();
  });

  it("says which stage failed, and lets the user try again", () => {
    const { client, push } = createStubClient();

    renderCard(client);
    pushState(push, "running", [MODEL]);
    fireEvent.click(screen.getByTestId("ollama-turn-on"));
    push(
      buildRpcMessage("ollama.enableFailed", {
        name: "nomic-embed-text",
        stage: "checking",
        reason: "17 of 20 pairs ordered correctly, 18 required",
      }),
    );

    expect(screen.getByTestId("ollama-enable-failure").textContent).toBe(
      "The model did not pass its quality check: 17 of 20 pairs ordered correctly, 18 required",
    );
    expect(screen.getByTestId("ollama-turn-on")).not.toBeNull();
  });

  it("keeps the model list and commands under More", () => {
    const { client, sent, push } = createStubClient();
    const ref = `ollama:nomic-embed-text:latest@${"a".repeat(64)}`;

    renderCard(client);
    pushState(push, "running", [MODEL]);

    expect(screen.getByTestId("ollama-more").contains(screen.getByTestId("ollama-use"))).toBe(true);

    fireEvent.click(screen.getByTestId("ollama-use"));
    push(buildRpcMessage("ollama.registered", { name: MODEL.name, ref }));

    expect(sent.at(-1)).toMatchObject({ type: "model.activate", payload: { ref } });
  });

  it("offers page summaries once local AI is on, saying what it downloads", () => {
    const { client, sent, push } = createStubClient();

    renderCard(client);
    pushState(push, "running", [{ ...MODEL, registeredRef: "ollama:x", isActive: true }]);

    expect(screen.getByTestId("ollama-summaries").textContent).toContain("qwen3:4b (2.5 GB)");

    fireEvent.click(screen.getByTestId("ollama-turn-on-summaries"));

    expect(sent.at(-1)).toMatchObject({ type: "ollama.enable", payload: { name: "qwen3:4b" } });

    push(
      buildRpcMessage("ollama.enableProgress", {
        name: "qwen3:4b",
        stage: "downloading",
        percent: 12,
      }),
    );

    expect(screen.getByTestId("ollama-summaries-progress").textContent).toBe(
      "Downloading the model 12%",
    );
    // The first step's progress is its own.
    expect(screen.getByTestId("ollama-on").textContent).toContain("Local AI is on");
  });

  it("does not offer page summaries before local AI is on", () => {
    const { client, push } = createStubClient();

    renderCard(client);
    pushState(push, "running", [MODEL]);

    expect(screen.queryByTestId("ollama-summaries")).toBeNull();
  });

  it("says why page summaries could not be turned on", () => {
    const { client, push } = createStubClient();

    renderCard(client);
    pushState(push, "running", [{ ...MODEL, registeredRef: "ollama:x", isActive: true }]);
    fireEvent.click(screen.getByTestId("ollama-turn-on-summaries"));
    push(
      buildRpcMessage("ollama.enableFailed", {
        name: "qwen3:4b",
        stage: "checking",
        reason: 'stops at its token limit: it reported "model"',
      }),
    );

    expect(screen.getByTestId("ollama-summaries-failure").textContent).toBe(
      'The model did not pass its quality check: stops at its token limit: it reported "model"',
    );
    expect(screen.getByTestId("ollama-turn-on-summaries")).not.toBeNull();
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
