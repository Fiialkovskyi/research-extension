import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";

import { type MapClient, MapApp } from "@/app/mapApp";
import "@/shared/styles/tailwind.css";
// After Tailwind, so its reset does not undo the graph's own styles. Bundled
// with the page like every other stylesheet; nothing is fetched.
import "@xyflow/react/dist/style.css";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Map root element #root is missing from map.html.");
}

/**
 * A long-lived connection: the background pushes a new snapshot of the graph
 * on it after every change, for as long as this page is open.
 */
const port = browser.runtime.connect();

const client: MapClient = {
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
    <MapApp client={client} />
  </StrictMode>,
);
