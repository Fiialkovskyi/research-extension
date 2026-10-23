import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";

import { SetupApp, type SetupClient } from "@/app/setupApp";
import "@/shared/styles/tailwind.css";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Root element #root is missing from setup.html.");
}

/**
 * A port rather than one-shot messages: "Turn on AI" streams its progress, and
 * an open port keeps the background loaded while it downloads.
 */
const port = browser.runtime.connect();

const client: SetupClient = {
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
      <SetupApp
        client={client}
        environment={{
          extensionOrigin: browser.runtime.getURL("/").replace(/\/$/u, ""),
          platform: os === "mac" || os === "win" ? os : "linux",
        }}
      />
    </StrictMode>,
  );
});
