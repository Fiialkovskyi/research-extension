import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";

import { PopupApp, type PopupClient } from "@/app/popupApp";
import "@/shared/styles/tailwind.css";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Popup root element #root is missing from popup.html.");
}

const client: PopupClient = {
  request: (message) => browser.runtime.sendMessage(message),
};

createRoot(container).render(
  <StrictMode>
    <PopupApp client={client} />
  </StrictMode>,
);
