import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OptionsApp, type SurfaceClient } from ".";
import { MINILM_L6_V2 } from "@/shared/config";
import { buildRpcMessage } from "@/shared/rpc";

/** A client that records what was sent and can push answers back. */
const createStubClient = () => {
  const sent: { type: string; payload: unknown }[] = [];
  const listeners: ((message: unknown) => void)[] = [];

  const client: SurfaceClient = {
    send: (message) => sent.push({ type: message.type, payload: message.payload }),
    subscribe: (listener) => {
      listeners.push(listener);

      return () => {
        listeners.splice(listeners.indexOf(listener), 1);
      };
    },
  };

  return {
    client,
    sent,
    listenerCount: () => listeners.length,
    answer: (type: string, payload: unknown) => {
      // Snapshot first: a listener may unsubscribe while being notified.
      for (const listener of Array.from(listeners)) {
        listener(buildRpcMessage(type, payload));
      }
    },
  };
};

const capabilities = { availableDevices: ["wasm"], crossOriginIsolated: false, threadCount: 1 };

describe("OptionsApp", () => {
  it("asks what this installation can run, what is installed, what the policy refused, where Ollama stands and how probe runs went", () => {
    const { client, sent } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);

    expect(sent.map((message) => message.type)).toEqual([
      // Children's effects run first: the blocked sites, the Ollama card, then the probe card.
      "denylist.read",
      "ollama.status",
      "spaces.list",
      "diagnostics.readProbes",
      "data.subscribe",
      "aiSetup.read",
      "inference.probe",
      "model.list",
      "diagnostics.read",
    ]);
  });

  it("starts no inference worker while in-extension models are switched off", () => {
    const { client, sent } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled={false} />);

    expect(sent.map((message) => message.type)).not.toContain("inference.probe");
    expect(screen.queryByTestId("in-browser-models")).not.toBeInTheDocument();
    expect(screen.queryByTestId("capabilities-pending")).not.toBeInTheDocument();
  });

  it("lists the models again when told they changed, and not for other changes", () => {
    const { client, sent, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);

    const count = () => sent.filter((message) => message.type === "model.list").length;
    const before = count();

    answer("data.changed", { topics: ["facts"] });
    expect(count()).toBe(before);

    answer("data.changed", { topics: ["models"] });
    expect(count()).toBe(before + 1);
  });

  it("leaves the probe card's answers to the card, so the page keeps rendering", () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    act(() => {
      answer("diagnostics.probeStarted", { runId: "run-1" });
      answer("diagnostics.probes", { runs: [] });
    });

    expect(screen.getByTestId("options-app")).toBeTruthy();
    expect(screen.getByTestId("probe-none")).toBeTruthy();
  });

  it("keeps models, measurements and developer tools under a closed Advanced section", () => {
    const { client } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);

    const advanced = screen.getByTestId("advanced-section") as HTMLDetailsElement;

    expect(advanced.open).toBe(false);
    expect(advanced.contains(screen.getByTestId("lifetime-probe"))).toBe(true);
    expect(advanced.contains(screen.getByTestId("ollama-card"))).toBe(true);
    expect(advanced.contains(screen.getByTestId("in-browser-models"))).toBe(true);
  });

  it("says AI is not set up, and opens setup in one click", async () => {
    const { client, sent, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled={false} />);
    answer("aiSetup.status", {
      isSetUp: false,
      isStarted: false,
      isBannerCollapsed: false,
    });

    await waitFor(() =>
      expect(screen.getByTestId("ai-status").textContent).toContain("AI isn't set up"),
    );

    fireEvent.click(screen.getByTestId("open-setup"));

    expect(sent.at(-1)?.type).toBe("aiSetup.open");
  });

  it("says which models are on once AI is set up", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled={false} />);
    answer("aiSetup.status", {
      isSetUp: true,
      isStarted: true,
      isBannerCollapsed: false,
    });
    answer("model.listed", {
      models: [
        {
          ref: "ollama:nomic-embed-text:latest@a",
          repository: "nomic-embed-text:latest",
          revision: "a",
          family: "embedding",
          conformance: "passed",
          diskBytes: 0,
          active: true,
          installedAt: 1,
        },
      ],
    });

    await waitFor(() =>
      expect(screen.getByTestId("ai-status").textContent).toContain(
        "AI is on, using nomic-embed-text:latest.",
      ),
    );
    expect(screen.getByTestId("open-setup").textContent).toBe("Open setup");
  });

  it("says it is still checking before an answer arrives", () => {
    const { client } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);

    expect(screen.getByTestId("capabilities-pending")).toBeInTheDocument();
  });

  it("reports the devices and that it runs single-threaded", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("inference.capabilities", capabilities);

    await waitFor(() => expect(screen.getByTestId("capabilities")).toBeInTheDocument());
    expect(screen.getByTestId("capabilities")).toHaveTextContent(/single-threaded/);
  });

  it("says plainly that the realm is not cross-origin isolated", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("inference.capabilities", capabilities);

    await waitFor(() =>
      expect(screen.getByTestId("capabilities")).toHaveTextContent(/no cross-origin isolation/),
    );
  });

  it("shows the empty state until a model is installed", () => {
    const { client } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);

    expect(screen.getByTestId("model-list-empty")).toBeInTheDocument();
  });

  it("lists what the background reports as installed", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("model.listed", {
      models: [
        {
          ref: "a",
          repository: MINILM_L6_V2.repository,
          revision: MINILM_L6_V2.revision,
          family: "embedding",
          quantization: "q8",
          conformance: "pending",
          diskBytes: 22_972_370,
          active: false,
          installedAt: 1,
        },
      ],
    });

    await waitFor(() => expect(screen.getByTestId("model-list")).toBeInTheDocument());
    expect(screen.getByText("23.0 MB")).toBeInTheDocument();
  });

  it("offers every bundled profile for installation", () => {
    const { client } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);

    expect(screen.getByTestId(`install-${MINILM_L6_V2.repository}`)).toBeInTheDocument();
  });

  it("asks the background to install the profile the user chose", () => {
    const { client, sent } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    fireEvent.click(screen.getByTestId(`install-${MINILM_L6_V2.repository}`));

    expect(sent.at(-1)).toEqual({
      type: "model.install",
      payload: { repository: MINILM_L6_V2.repository },
    });
  });

  it("shows progress while the install runs", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    fireEvent.click(screen.getByTestId(`install-${MINILM_L6_V2.repository}`));
    answer("model.installProgress", {
      path: "onnx/model_quantized.onnx",
      completedFiles: 1,
      totalFiles: 5,
      completedBytes: 5,
      totalBytes: 10,
    });

    await waitFor(() => expect(screen.getByTestId("install-running")).toHaveTextContent("50%"));
  });

  it("prevents a second install while one is running", () => {
    const { client } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    fireEvent.click(screen.getByTestId(`install-${MINILM_L6_V2.repository}`));

    expect(screen.getByTestId(`install-${MINILM_L6_V2.repository}`)).toBeDisabled();
  });

  it("refreshes the list once a model is installed", async () => {
    const { client, sent, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    fireEvent.click(screen.getByTestId(`install-${MINILM_L6_V2.repository}`));
    answer("model.installed", { ref: "a@b", diskBytes: 1, conformance: "pending" });

    await waitFor(() => expect(sent.at(-1)?.type).toBe("model.list"));
  });

  it("shows why an install failed", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    fireEvent.click(screen.getByTestId(`install-${MINILM_L6_V2.repository}`));
    answer("model.installFailed", {
      repository: MINILM_L6_V2.repository,
      reason: "digest mismatch",
    });

    await waitFor(() =>
      expect(screen.getByTestId("install-failed")).toHaveTextContent(/digest mismatch/),
    );
  });

  it("surfaces a refusal from the background", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("inference.failed", { reason: "worker crashed" });

    await waitFor(() =>
      expect(screen.getByTestId("options-problem")).toHaveTextContent("worker crashed"),
    );
  });

  it("surfaces a protocol refusal from the background", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("rpc.refused", { rejection: "unknown-type", reason: "Unknown message type" });

    await waitFor(() =>
      expect(screen.getByTestId("options-problem")).toHaveTextContent("Unknown message type"),
    );
  });

  it("ignores a message it cannot validate rather than breaking the surface", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("model.listed", { models: "not a list" });
    answer("inference.capabilities", capabilities);

    await waitFor(() => expect(screen.getByTestId("capabilities")).toBeInTheDocument());
  });

  it("stops listening when it unmounts", () => {
    const { client, listenerCount } = createStubClient();
    const { unmount } = render(<OptionsApp client={client} isInBrowserBackendEnabled />);

    unmount();

    expect(listenerCount()).toBe(0);
  });

  it("offers only the profiles it is given", () => {
    const { client } = createStubClient();

    render(<OptionsApp client={client} profiles={[]} />);

    expect(screen.queryByTestId(`install-${MINILM_L6_V2.repository}`)).not.toBeInTheDocument();
  });

  it("carries a light and dark pair, so it follows the system scheme", () => {
    const { client } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);

    expect(screen.getByTestId("options-app").className).toMatch(/dark:/);
  });
});

describe("OptionsApp, choosing a device and measuring", () => {
  const installed = {
    ref: "owner/model@abc",
    repository: "owner/model",
    revision: "a".repeat(40),
    family: "embedding" as const,
    quantization: "q8",
    conformance: "pending" as const,
    diskBytes: 1,
    active: false,
    installedAt: 1,
  };

  const measured = {
    ref: installed.ref,
    device: "wasm" as const,
    chunkCount: 40,
    durationMs: 2_000,
    chunksPerSecond: 20,
    loadDurationMs: 1_500,
    meetsBudget: true,
    threadCount: 1,
  };

  it("offers a throughput measurement only for an embedding model", async () => {
    const { client, answer } = createStubClient();
    const generator = {
      ...installed,
      ref: "ollama:qwen3:4b@x",
      repository: "qwen3:4b",
      family: "text-generation" as const,
    };

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("model.listed", { models: [installed, generator] });

    await waitFor(() => expect(screen.getByTestId(`measure-${installed.ref}`)).toBeInTheDocument());
    expect(screen.queryByTestId(`measure-${generator.ref}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`activate-${generator.ref}`)).toBeInTheDocument();
  });

  it("offers the software path and the accelerated one", () => {
    const { client } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);

    expect(screen.getByTestId("device-wasm")).toBeChecked();
    expect(screen.getByTestId("device-webgpu")).not.toBeChecked();
  });

  it("disables a path this installation cannot reach", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("inference.capabilities", capabilities);

    await waitFor(() => expect(screen.getByTestId("device-webgpu")).toBeDisabled());
    expect(screen.getByTestId("device-wasm")).not.toBeDisabled();
  });

  it("activates a model on the chosen path", async () => {
    const { client, sent, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("model.listed", { models: [installed] });
    await waitFor(() =>
      expect(screen.getByTestId(`activate-${installed.ref}`)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId(`activate-${installed.ref}`));

    expect(sent.at(-1)).toEqual({
      type: "model.activate",
      payload: { ref: installed.ref, device: "wasm" },
    });
  });

  it("carries the newly chosen path into the next request", async () => {
    const { client, sent, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("model.listed", { models: [installed] });
    await waitFor(() => expect(screen.getByTestId(`measure-${installed.ref}`)).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("device-webgpu"));
    fireEvent.click(screen.getByTestId(`measure-${installed.ref}`));

    expect(sent.at(-1)).toEqual({
      type: "benchmark.run",
      payload: { ref: installed.ref, device: "webgpu" },
    });
  });

  it("shows every check an activation ran, passed or failed", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("model.activated", {
      ref: installed.ref,
      active: false,
      conformance: "failed",
      device: "wasm",
      reason: "4 of 20 pairs ordered correctly, 18 required",
      probes: [
        { name: "normalizes as declared", passed: true, detail: "every vector is unit length" },
        {
          name: "places a paraphrase closer than a stranger",
          passed: false,
          detail: "4 of 20 pairs ordered correctly",
        },
      ],
    });

    await waitFor(() => expect(screen.getByTestId("probe-list")).toBeInTheDocument());
    expect(screen.getByTestId("probe-list")).toHaveTextContent(/Passed — normalizes as declared/);
    expect(screen.getByTestId("probe-list")).toHaveTextContent(/Failed — places a paraphrase/);
    expect(screen.getByTestId("probe-summary")).toHaveTextContent("1 of 2 checks failed");
  });

  it("says the checks are running, then how they went", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("model.listed", { models: [installed] });
    await waitFor(() =>
      expect(screen.getByTestId(`activate-${installed.ref}`)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId(`activate-${installed.ref}`));

    expect(screen.getByTestId("probe-checking")).toHaveTextContent("Checking the model…");

    answer("model.activated", {
      ref: installed.ref,
      active: true,
      conformance: "passed",
      device: "wasm",
      probes: [{ name: "reproduces a vector", passed: true, detail: "1.00000" }],
    });

    await waitFor(() =>
      expect(screen.getByTestId("probe-summary")).toHaveTextContent("All 1 checks passed"),
    );
    expect(screen.queryByTestId("probe-checking")).not.toBeInTheDocument();
  });

  it("reports a refusal even when the request itself succeeded", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("model.activated", {
      ref: installed.ref,
      active: false,
      conformance: "failed",
      device: "wasm",
      reason: "4 of 20 pairs ordered correctly, 18 required",
      probes: [],
    });

    await waitFor(() =>
      expect(screen.getByTestId("options-problem")).toHaveTextContent(/18 required/),
    );
  });

  it("refreshes the list after an activation, since what it shows has changed", async () => {
    const { client, sent, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    const listsBefore = sent.filter((message) => message.type === "model.list").length;

    answer("model.activated", {
      ref: installed.ref,
      active: true,
      conformance: "passed",
      device: "wasm",
      probes: [],
    });

    await waitFor(() =>
      expect(sent.filter((message) => message.type === "model.list").length).toBe(listsBefore + 1),
    );
  });

  it("shows the measurement against the budget", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("benchmark.measured", measured);

    await waitFor(() => expect(screen.getByTestId("benchmark-report")).toBeInTheDocument());
    expect(screen.getByTestId("benchmark-report")).toHaveTextContent("20.0 chunks/s");
    expect(screen.getByTestId("benchmark-report")).toHaveTextContent(/single-threaded/);
  });

  it("says it is measuring while the run is in flight", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("model.listed", { models: [installed] });
    await waitFor(() => expect(screen.getByTestId(`measure-${installed.ref}`)).toBeInTheDocument());
    fireEvent.click(screen.getByTestId(`measure-${installed.ref}`));

    expect(screen.getByTestId("benchmark-running")).toBeInTheDocument();
  });

  it("reports a failed measurement", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("benchmark.failed", { ref: installed.ref, reason: "the runtime gave up" });

    await waitFor(() =>
      expect(screen.getByTestId("options-problem")).toHaveTextContent("the runtime gave up"),
    );
  });

  it("prevents a second operation while one is running, since they share one worker", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("model.listed", { models: [installed] });
    await waitFor(() => expect(screen.getByTestId(`measure-${installed.ref}`)).toBeInTheDocument());
    fireEvent.click(screen.getByTestId(`measure-${installed.ref}`));

    expect(screen.getByTestId(`activate-${installed.ref}`)).toBeDisabled();
    expect(screen.getByTestId("device-wasm")).toBeDisabled();
  });

  it("discards a measurement when the device changes under it", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("benchmark.measured", measured);
    await waitFor(() => expect(screen.getByTestId("benchmark-report")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("device-webgpu"));

    expect(screen.queryByTestId("benchmark-report")).not.toBeInTheDocument();
  });
});

describe("OptionsApp, reporting the network policy", () => {
  it("shows what the package may reach once the background has said", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("diagnostics.report", {
      permittedOrigins: ["https://huggingface.co", "https://*.hf.co"],
      blocked: [],
    });

    await waitFor(() => expect(screen.getByTestId("policy-report")).toBeInTheDocument());
    expect(screen.getByTestId("policy-nothing-blocked")).toBeInTheDocument();
  });

  it("names an origin the policy refused", async () => {
    const { client, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    answer("diagnostics.report", {
      permittedOrigins: ["https://huggingface.co"],
      blocked: [{ origin: "https://cdn.jsdelivr.net", directive: "connect-src" }],
    });

    await waitFor(() =>
      expect(screen.getByTestId("policy-blocked")).toHaveTextContent(/cdn\.jsdelivr\.net/),
    );
  });

  it("asks again after an install, which is when a refusal would have happened", async () => {
    const { client, sent, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    const before = sent.filter((message) => message.type === "diagnostics.read").length;

    answer("model.installed", { ref: "a@b", diskBytes: 1, conformance: "pending" });

    await waitFor(() =>
      expect(sent.filter((message) => message.type === "diagnostics.read").length).toBe(before + 1),
    );
  });

  it("asks again after a failed install, which is the case that needs the reason", async () => {
    const { client, sent, answer } = createStubClient();

    render(<OptionsApp client={client} isInBrowserBackendEnabled />);
    const before = sent.filter((message) => message.type === "diagnostics.read").length;

    answer("model.installFailed", { repository: "owner/model", reason: "failed to fetch" });

    await waitFor(() =>
      expect(sent.filter((message) => message.type === "diagnostics.read").length).toBe(before + 1),
    );
  });
});
