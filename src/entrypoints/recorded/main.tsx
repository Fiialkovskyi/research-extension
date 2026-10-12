import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";

import { type RecordedClient, RecordedApp } from "@/app/recordedApp";
import "@/shared/styles/tailwind.css";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Root element #root is missing from recorded.html.");
}

const client: RecordedClient = {
  request: (message) => browser.runtime.sendMessage(message),
};

createRoot(container).render(
  <StrictMode>
    <RecordedApp client={client} />
  </StrictMode>,
);
