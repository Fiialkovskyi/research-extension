import { browser, expect } from "@wdio/globals";

import { OPTIONS_PATH } from "@/shared/config";
import { getExtensionUrl } from "../fixtures/firefoxExtension/utils";

/** The manifest Firefox actually loaded, read from inside one of the add-on's own pages. */
const readInstalledManifest = async (): Promise<Record<string, unknown>> => {
  await browser.url(getExtensionUrl(OPTIONS_PATH));

  return browser.execute(() =>
    (
      globalThis as unknown as {
        browser: { runtime: { getManifest: () => Record<string, unknown> } };
      }
    ).browser.runtime.getManifest(),
  );
};

// What the package asks the user for at install: only what its surfaces use,
// page access never granted up front, and no model host while the in-extension
// backend is off.
describe("manifest", () => {
  it("declares exactly the API permissions its surfaces use", async () => {
    const manifest = await readInstalledManifest();

    expect([...(manifest["permissions"] as string[])].toSorted()).toEqual([
      "alarms",
      "idle",
      "notifications",
      "scripting",
      "sessions",
      "tabGroups",
      "tabs",
      "webNavigation",
    ]);
  });

  it("requires page access and the local Ollama server, and nothing optional", async () => {
    const manifest = await readInstalledManifest();

    expect(manifest["host_permissions"]).toEqual(["<all_urls>", "http://127.0.0.1:11434/*"]);
    expect(manifest["optional_host_permissions"] ?? []).toEqual([]);
  });

  it("admits no model host in its connection policy", async () => {
    const manifest = await readInstalledManifest();
    const policy = (manifest["content_security_policy"] as { extension_pages: string })
      .extension_pages;

    expect(policy).toContain("connect-src 'self' http://127.0.0.1:11434");
    expect(policy).not.toMatch(/hf\.co|huggingface/u);
  });
});
