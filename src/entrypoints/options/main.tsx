import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";

import { OptionsApp, type SurfaceClient } from "@/app/optionsApp";
import { LOCAL_INFERENCE_ORIGINS } from "@/shared/config";
import "@/shared/styles/tailwind.css";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Options root element #root is missing from options.html.");
}

/**
 * A long-lived connection rather than one-shot messages, for two reasons: an
 * install streams progress while it is still running, and an open port is what
 * keeps the background from unloading in the middle of that work.
 */
const port = browser.runtime.connect();

const client: SurfaceClient = {
  send: (message) => {
    port.postMessage(message);
  },
  subscribe: (listener) => {
    const receive = (message: unknown) => {
      listener(message);
    };

    port.onMessage.addListener(receive);

    return () => {
      port.onMessage.removeListener(receive);
    };
  },
};

// The command that lets Ollama trust this extension names this installation's
// origin and is written for this operating system, so both are read first.
void browser.runtime.getPlatformInfo().then(({ os }) => {
  createRoot(container).render(
    <StrictMode>
      <OptionsApp
        client={client}
        requestOllamaAccess={() =>
          browser.permissions.request({
            origins: LOCAL_INFERENCE_ORIGINS.map((origin) => `${origin}/*`),
          })
        }
        ollamaEnvironment={{
          extensionOrigin: browser.runtime.getURL("/").replace(/\/$/u, ""),
          platform: os === "mac" || os === "win" ? os : "linux",
        }}
      />
    </StrictMode>,
  );
});
