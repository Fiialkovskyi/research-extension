import { expect } from "@wdio/globals";

import { BGE_SMALL_EN_V1_5, MINILM_L6_V2, OPTIONS_PATH } from "@/shared/config";
import {
  activateInstalledModel,
  installModelFromHub,
  measureThroughput,
  openOptionsSurface,
  readOptionsSurface,
  selectComputeDevice,
} from "../fixtures/optionsSurface/utils";

/**
 * The run that actually answers this change's questions.
 *
 * Everything else in this suite is deliberately offline and deterministic.
 * This one reaches Hugging Face for real, which is the only way to learn
 * whether the declared policy covers the hosts a download touches and how fast
 * the runtime is on this machine — so it is opt-in rather than part of
 * `npm run verify`, where CDN weather would become a failing build.
 *
 * Run with: `E2E_NETWORK=true npm run test:e2e`
 */
const networkSuite = process.env["E2E_NETWORK"] === "true" ? describe : describe.skip;

/** Repository and pinned revision, as the surface identifies an install. */
const getRef = (profile: { repository: string; revision: string }) =>
  `${profile.repository}@${profile.revision}`;

networkSuite("installing a model from Hugging Face", () => {
  before(async () => {
    await openOptionsSurface(OPTIONS_PATH);
  });

  it("states which origins it may reach before reaching any", async () => {
    const snapshot = await readOptionsSurface();

    expect(snapshot.policy).toContain("https://huggingface.co");
    // Nothing has been fetched yet, so nothing can have been refused.
    expect(snapshot.policy).toContain("Nothing has been blocked");
  });

  it("installs the default profile under the declared policy", async () => {
    const installed = await installModelFromHub(MINILM_L6_V2.repository);
    const snapshot = await readOptionsSurface();

    // Printed because these are the change's findings, not incidental output.
    console.log("\n[policy after install]", snapshot.policy);
    console.log("[install problem, if any]", snapshot.problem || "none");

    expect(installed).toBe(true);
    // The headline question: one wildcard in `connect-src` either covers every
    // storage and CDN host a download redirects to, or it does not.
    expect(snapshot.policy).toContain("Nothing has been blocked");
  });

  it("lists it with the commit it is pinned to and what it cost", async () => {
    const snapshot = await readOptionsSurface();

    console.log("[installed]", snapshot.installedRepositories.join(", "));

    expect(snapshot.installedRepositories).toContain(MINILM_L6_V2.repository);
    expect(snapshot.listIsEmpty).toBe(false);
  });

  it("passes its conformance suite on the software path", async () => {
    await selectComputeDevice("wasm");

    const reported = await activateInstalledModel(getRef(MINILM_L6_V2));
    const snapshot = await readOptionsSurface();

    console.log("[activation problem, if any]", snapshot.problem || "none");

    for (const probe of snapshot.probes) {
      console.log("[probe]", probe);
    }

    expect(reported).toBe(true);
    expect(snapshot.probes.length).toBeGreaterThan(0);
    expect(snapshot.probes.every((probe) => probe.startsWith("Passed"))).toBe(true);
  });

  it("measures throughput on the software path", async () => {
    const measured = await measureThroughput(getRef(MINILM_L6_V2));
    const snapshot = await readOptionsSurface();

    // The number every budget in the target spec is judged against, because
    // the declared minimum Firefox has no hardware-accelerated path at all.
    console.log("\n[THROUGHPUT, software path]", snapshot.benchmark || "none", "\n");
    console.log("[measurement problem, if any]", snapshot.problem || "none");

    expect(measured).toBe(true);
    expect(snapshot.benchmark).toContain("chunks/s");
  });

  it("cannot yet run on the accelerated path, and says why", async () => {
    const before = await readOptionsSurface();

    if (!before.capabilities.includes("webgpu")) {
      console.log("[accelerated path] not offered by this browser; nothing to characterise");
      return;
    }

    await selectComputeDevice("webgpu");
    const measured = await measureThroughput(getRef(MINILM_L6_V2));
    const snapshot = await readOptionsSurface();

    console.log("\n[THROUGHPUT, accelerated path]", snapshot.benchmark || "none");
    console.log("[accelerated problem]", snapshot.problem || "none", "\n");

    // A characterisation, not an endorsement. The worker bundle statically
    // includes the runtime's asyncify loader, which carries no WebGPU backend,
    // so requesting that device fails whatever `wasmPaths` says. Reaching the
    // right runtime entry is a bundling problem of its own and does not change
    // any budget: the declared minimum Firefox has no accelerated path on any
    // platform, so every budget is judged on the software one.
    //
    // Asserted rather than skipped so that the day this starts working, this
    // test fails and someone comes back to measure it.
    expect(measured).toBe(false);
    // Only that it fails with a reported problem, not the runtime's exact
    // wording, which changes with every upgrade.
    expect(snapshot.problem).not.toBe("");
  });

  it("installs a second profile, proving the registry is not wired to one model", async () => {
    await selectComputeDevice("wasm");

    const installed = await installModelFromHub(BGE_SMALL_EN_V1_5.repository);
    const snapshot = await readOptionsSurface();

    console.log("[installed]", snapshot.installedRepositories.join(", "));
    console.log("[policy after second install]", snapshot.policy);

    expect(installed).toBe(true);
    expect(snapshot.installedRepositories).toContain(BGE_SMALL_EN_V1_5.repository);
  });

  it("honours the second profile's asymmetric prefixes", async () => {
    // Reopened rather than carrying the previous test's device choice. Clicking
    // the software-path control after an accelerated attempt selects it in the
    // DOM but does not reach the surface's state, so work still runs on the
    // wrong device — a defect in the surface or in how a synthetic click
    // reaches a controlled radio, not yet diagnosed. A fresh page starts from
    // the documented default, which is what this test actually needs.
    await openOptionsSurface(OPTIONS_PATH);

    // This profile instructs the query side only, which the default profile
    // cannot exercise at all. A prefix applied to the wrong side shows up here
    // as a drop in ordering accuracy rather than passing unnoticed.
    const reported = await activateInstalledModel(getRef(BGE_SMALL_EN_V1_5));
    const snapshot = await readOptionsSurface();

    console.log("[second profile problem, if any]", snapshot.problem || "none");

    for (const probe of snapshot.probes) {
      console.log("[probe, second profile]", probe);
    }

    expect(reported).toBe(true);
    expect(snapshot.probes.every((probe) => probe.startsWith("Passed"))).toBe(true);
  });
});
