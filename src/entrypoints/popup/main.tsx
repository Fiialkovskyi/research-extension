import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";

import { type GraphStream, type PageAccess, PopupApp, type PopupClient } from "@/app/popupApp";
import { PAGE_ACCESS_ORIGINS } from "@/features/pageSignals";
import "@/shared/styles/tailwind.css";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Popup root element #root is missing from popup.html.");
}

const client: PopupClient = {
  request: (message) => browser.runtime.sendMessage(message),
};

const pageAccess: PageAccess = {
  isGranted: () => browser.permissions.contains({ origins: PAGE_ACCESS_ORIGINS }),
  request: () => browser.permissions.request({ origins: PAGE_ACCESS_ORIGINS }),
};

/**
 * The research tree's connection: the background pushes the graph on it after
 * every change, and drops it when the popup closes.
 */
const port = browser.runtime.connect();

const graph: GraphStream = {
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

createRoot(container).render(
  <StrictMode>
    <PopupApp
      client={client}
      pageAccess={pageAccess}
      graph={graph}
      openSettings={() => {
        void browser.runtime.openOptionsPage();
      }}
    />
  </StrictMode>,
);
