import { browser, expect } from "@wdio/globals";

import { IS_IN_BROWSER_BACKEND_ENABLED, OPTIONS_PATH } from "@/shared/config";
import {
  clearSystemColorScheme,
  enterBrowserChrome,
  leaveBrowserChrome,
  setSystemColorScheme,
  type SystemColorScheme,
} from "../fixtures/firefoxToolbar/utils";
import { openOptionsSurface, readOptionsSurface } from "../fixtures/optionsSurface/utils";

/** Sets the system preference, which needs the privileged context, then reads the page. */
const readSurfaceUnder = async (scheme: SystemColorScheme) => {
  await enterBrowserChrome();
  await setSystemColorScheme(scheme);
  await leaveBrowserChrome();

  await openOptionsSurface(OPTIONS_PATH);

  return readOptionsSurface();
};

/** Tests of the in-extension backend, which run only while it is switched on. */
const inBrowserIt = IS_IN_BROWSER_BACKEND_ENABLED ? it : it.skip;

describe("options surface", () => {
  after(async () => {
    await enterBrowserChrome();
    await clearSystemColorScheme();
    await leaveBrowserChrome();
  });

  it("says AI is not set up on a fresh install, over a live port to the background", async () => {
    await openOptionsSurface(OPTIONS_PATH);

    const snapshot = await readOptionsSurface();

    expect(snapshot.isAiSetUp).toBe(false);
    expect(snapshot.aiStatus).toContain("AI isn't set up");
    expect(snapshot.aiStatus).toContain("Set up AI");
  });

  inBrowserIt(
    "reports what this installation can run, over a live port to the background",
    async () => {
      await openOptionsSurface(OPTIONS_PATH);

      const snapshot = await readOptionsSurface();

      // Reaching this line already proves the chain: the surface connected a
      // port, the background spawned the inference worker, and the worker
      // answered. The assertions below are about what it said.
      expect(snapshot.capabilities).toContain("wasm");
      expect(snapshot.capabilities).toMatch(/single-threaded|threads/);
    },
  );

  inBrowserIt("reports the isolation that decides whether threads are available", async () => {
    await openOptionsSurface(OPTIONS_PATH);

    const snapshot = await readOptionsSurface();

    // Extension pages in Firefox cannot be cross-origin isolated, so the
    // surface is expected to say so and to report a single thread. If this ever
    // changes, this test is where it surfaces rather than as a silent speed-up.
    expect(snapshot.capabilities).toContain("no cross-origin isolation");
    expect(snapshot.capabilities).toContain("single-threaded");
  });

  inBrowserIt("says nothing is installed before anything is", async () => {
    await openOptionsSurface(OPTIONS_PATH);

    expect((await readOptionsSurface()).listIsEmpty).toBe(true);
  });

  it("follows the system colour scheme and keeps its text legible", async () => {
    const light = await readSurfaceUnder("light");
    const dark = await readSurfaceUnder("dark");

    // Palette-independent: the two appearances must differ, and in each the
    // text must not be painted onto its own background colour.
    expect(light.backgroundColor).not.toBe(dark.backgroundColor);
    expect(light.textColor).not.toBe(light.backgroundColor);
    expect(dark.textColor).not.toBe(dark.backgroundColor);
  });

  it("sends nothing to Ollama before setup starts, and admits only its loopback origin", async () => {
    await openOptionsSurface(OPTIONS_PATH);

    await browser.waitUntil(
      async () => (await readOptionsSurface()).ollamaState === "notConnected",
      { timeoutMsg: "The Ollama models never said AI is not set up" },
    );

    const snapshot = await readOptionsSurface();

    expect(snapshot.ollamaText).toContain("AI isn't set up yet.");
    expect(snapshot.policy).toContain("http://127.0.0.1:11434");
    expect(snapshot.policy).not.toMatch(/huggingface|hf\.co/u);
  });
});
