import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SetupWizard, type SetupWizardProps } from ".";
import { OLLAMA_DOWNLOAD_URL } from "@/shared/config";

afterEach(cleanup);

const renderWizard = (overrides: Partial<SetupWizardProps> = {}) => {
  const props: SetupWizardProps = {
    step: "checking",
    plan: undefined,
    progress: undefined,
    failure: undefined,
    activeModels: [],
    allowCommand: {
      where: "Open Terminal and paste:",
      command: "launchctl …",
      afterward: undefined,
    },
    onTurnOn: vi.fn(),
    onCheckNow: vi.fn(),
    ...overrides,
  };

  render(<SetupWizard {...props} />);

  return props;
};

describe("SetupWizard", () => {
  it("shows only the current step", () => {
    renderWizard({ step: "getOllama" });

    expect(screen.getByTestId("setup-step").dataset["step"]).toBe("getOllama");
    expect(screen.queryByTestId("setup-turn-on")).toBeNull();
  });

  it("links to Ollama's download page, and says opening it is enough if installed", () => {
    const props = renderWizard({ step: "getOllama" });

    expect(screen.getByTestId("setup-download").getAttribute("href")).toBe(OLLAMA_DOWNLOAD_URL);
    expect(screen.getByTestId("setup-step").textContent).toContain("Already have it? Just open it");

    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    expect(props.onCheckNow).toHaveBeenCalledOnce();
  });

  it("gives one command to copy when Ollama refuses the extension", () => {
    renderWizard({ step: "allowExtension" });

    expect(screen.getByTestId("setup-allow-command").textContent).toBe("launchctl …");
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  });

  it("says how much it downloads before the user turns AI on", () => {
    const props = renderWizard({
      step: "turnOn",
      plan: { steps: [], downloadBytes: 2_774_000_000 },
    });

    expect(screen.getByTestId("setup-size").textContent).toContain("about 2.8 GB");

    fireEvent.click(screen.getByTestId("setup-turn-on"));
    expect(props.onTurnOn).toHaveBeenCalledOnce();
  });

  it("says when nothing needs downloading", () => {
    renderWizard({ step: "turnOn", plan: { steps: [], downloadBytes: 0 } });

    expect(screen.getByTestId("setup-size").textContent).toContain("nothing to download");
  });

  it("names the model and stage that failed, and offers to try again", () => {
    renderWizard({
      step: "turnOn",
      failure: { name: "qwen3:4b", stage: "checking", reason: "It did not pass." },
    });

    expect(screen.getByRole("alert").textContent).toBe(
      "Checking qwen3:4b failed: It did not pass.",
    );
    expect(screen.getByTestId("setup-turn-on").textContent).toBe("Try again");
  });

  it("shows one progress while turning on, and that similar pages already work", () => {
    renderWizard({
      step: "turningOn",
      progress: {
        name: "qwen3:4b",
        family: "text-generation",
        stage: "downloading",
        fraction: 0.42,
        isEmbeddingReady: true,
      },
    });

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("42");
    expect(screen.getByTestId("setup-progress").textContent).toContain("summaries (qwen3:4b)");
    expect(screen.getByTestId("setup-embedding-ready")).toBeTruthy();
  });

  it("says AI is on, with which models", () => {
    renderWizard({ step: "done", activeModels: ["nomic-embed-text:latest", "qwen3:4b"] });

    expect(screen.getByTestId("setup-active-models").textContent).toBe(
      "Using nomic-embed-text:latest and qwen3:4b.",
    );
  });
});
