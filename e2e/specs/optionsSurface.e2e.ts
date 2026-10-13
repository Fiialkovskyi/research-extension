import { browser, expect } from "@wdio/globals";

import { OPTIONS_PATH } from "@/shared/config";
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

describe("options surface", () => {
  after(async () => {
    await enterBrowserChrome();
    await clearSystemColorScheme();
    await leaveBrowserChrome();
  });

  it("reports what this installation can run, over a live port to the background", async () => {
    await openOptionsSurface(OPTIONS_PATH);

    const snapshot = await readOptionsSurface();

    // Reaching this line already proves the chain: the surface connected a
    // port, the background spawned the inference worker, and the worker
    // answered. The assertions below are about what it said.
    expect(snapshot.capabilities).toContain("wasm");
    expect(snapshot.capabilities).toMatch(/single-threaded|threads/);
  });

  it("reports the isolation that decides whether threads are available", async () => {
    await openOptionsSurface(OPTIONS_PATH);

    const snapshot = await readOptionsSurface();

    // Extension pages in Firefox cannot be cross-origin isolated, so the
    // surface is expected to say so and to report a single thread. If this ever
    // changes, this test is where it surfaces rather than as a silent speed-up.
    expect(snapshot.capabilities).toContain("no cross-origin isolation");
    expect(snapshot.capabilities).toContain("single-threaded");
  });

  it("says nothing is installed before anything is", async () => {
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

  it("offers Ollama as an optional set-up, and admits only its loopback origin", async () => {
    await openOptionsSurface(OPTIONS_PATH);

    // Access to the local server is optional and not yet granted, so the card
    // asks before anything is sent to it — whether or not Ollama is running.
    await browser.waitUntil(
      async () => (await readOptionsSurface()).ollamaState === "notConnected",
      {
        timeoutMsg: "The Ollama card never said it is not connected",
      },
    );

    const snapshot = await readOptionsSurface();

    expect(snapshot.ollamaText).toContain("(optional)");
    expect(snapshot.ollamaText).toContain("Set up Ollama");
    expect(snapshot.policy).toContain("http://127.0.0.1:11434");
  });
});
