import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BENCHMARK_TEST_ID,
  CAPABILITIES_TEST_ID,
  EMPTY_LIST_TEST_ID,
  OLLAMA_CARD_TEST_ID,
  POLICY_TEST_ID,
  PROBE_LIST_TEST_ID,
  PROBLEM_TEST_ID,
  SURFACE_TEST_ID,
} from "../../constants";

// readOptionsSurface hands browser.execute a real function reference rather
// than a script string, so the mock can run it directly against this file's
// own jsdom environment instead of a remote browser.
const { execute } = vi.hoisted(() => ({
  execute: vi.fn((script: (...args: never[]) => unknown, ...args: never[]) => script(...args)),
}));

vi.mock("@wdio/globals", () => ({ browser: { execute } }));

const { readOptionsSurface } = await import("./index");

describe("readOptionsSurface", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("throws when the options surface has not mounted", async () => {
    await expect(readOptionsSurface()).rejects.toThrow("The options surface is not present");
  });

  it("reads the reported capabilities, probes, benchmark and policy as rendered", async () => {
    document.body.innerHTML = `
      <div data-testid="${SURFACE_TEST_ID}" style="background-color: rgb(17, 17, 17); color: rgb(255, 255, 255);">
        <p data-testid="${CAPABILITIES_TEST_ID}"> 2 threads, wasm and webgpu </p>
        <ul data-testid="${PROBE_LIST_TEST_ID}">
          <li> cosine similarity: pass </li>
          <li> ordering: pass </li>
        </ul>
        <p data-testid="${BENCHMARK_TEST_ID}"> 120 embeddings/sec </p>
        <p data-testid="${POLICY_TEST_ID}"> permits huggingface.co </p>
      </div>
    `;

    const snapshot = await readOptionsSurface();

    expect(snapshot.capabilities).toBe("2 threads, wasm and webgpu");
    expect(snapshot.backgroundColor).toBe("rgb(17, 17, 17)");
    expect(snapshot.textColor).toBe("rgb(255, 255, 255)");
    expect(snapshot.probes).toEqual(["cosine similarity: pass", "ordering: pass"]);
    expect(snapshot.benchmark).toBe("120 embeddings/sec");
    expect(snapshot.policy).toBe("permits huggingface.co");
    expect(snapshot.problem).toBe("");
  });

  it("reports an empty list until a model is installed", async () => {
    document.body.innerHTML = `
      <div data-testid="${SURFACE_TEST_ID}">
        <p data-testid="${EMPTY_LIST_TEST_ID}"></p>
      </div>
    `;

    const snapshot = await readOptionsSurface();

    expect(snapshot.listIsEmpty).toBe(true);
    expect(snapshot.installedRepositories).toEqual([]);
  });

  it("lists installed repositories once models are rendered", async () => {
    document.body.innerHTML = `
      <div data-testid="${SURFACE_TEST_ID}">
        <div data-testid="model-list-item"><p> Xenova/all-MiniLM-L6-v2 </p></div>
        <div data-testid="model-list-item"><p> Xenova/bge-small-en-v1.5 </p></div>
      </div>
    `;

    const snapshot = await readOptionsSurface();

    expect(snapshot.listIsEmpty).toBe(false);
    expect(snapshot.installedRepositories).toEqual([
      "Xenova/all-MiniLM-L6-v2",
      "Xenova/bge-small-en-v1.5",
    ]);
  });

  it("surfaces a reported problem", async () => {
    document.body.innerHTML = `
      <div data-testid="${SURFACE_TEST_ID}">
        <p data-testid="${PROBLEM_TEST_ID}"> Digest mismatch for onnx/model_quantized.onnx </p>
      </div>
    `;

    const snapshot = await readOptionsSurface();

    expect(snapshot.problem).toBe("Digest mismatch for onnx/model_quantized.onnx");
  });

  it("reads where the Ollama card says the local server stands", async () => {
    document.body.innerHTML = `
      <div data-testid="${SURFACE_TEST_ID}">
        <section data-testid="${OLLAMA_CARD_TEST_ID}" data-state="notConnected"> Connect to Ollama </section>
      </div>
    `;

    const snapshot = await readOptionsSurface();

    expect(snapshot.ollamaState).toBe("notConnected");
    expect(snapshot.ollamaText).toBe("Connect to Ollama");
  });

  it("reads no Ollama state when the card is absent", async () => {
    document.body.innerHTML = `<div data-testid="${SURFACE_TEST_ID}"></div>`;

    expect((await readOptionsSurface()).ollamaState).toBe("");
  });
});
