import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";

import { SummariesApp, type SummariesClient } from "@/app/summariesApp";
import "@/shared/styles/tailwind.css";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Root element #root is missing from summaries.html.");
}

const client: SummariesClient = {
  request: (message) => browser.runtime.sendMessage(message),
};

createRoot(container).render(
  <StrictMode>
    <SummariesApp client={client} />
  </StrictMode>,
);
