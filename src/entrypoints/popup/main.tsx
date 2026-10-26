import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";

import { type PageAccess, PopupApp, type PopupClient } from "@/app/popupApp";
import { watchDataChanges } from "@/features/liveData";
import { PAGE_ACCESS_ORIGINS } from "@/features/pageSignals";
import "@/shared/styles/tailwind.css";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Popup root element #root is missing from popup.html.");
}

const client: PopupClient = {
  request: (message) => browser.runtime.sendMessage(message),
  watch: (onChange) => watchDataChanges({ connect: () => browser.runtime.connect(), onChange }),
};

const pageAccess: PageAccess = {
  isGranted: () => browser.permissions.contains({ origins: PAGE_ACCESS_ORIGINS }),
  request: () => browser.permissions.request({ origins: PAGE_ACCESS_ORIGINS }),
};

createRoot(container).render(
  <StrictMode>
    <PopupApp
      client={client}
      pageAccess={pageAccess}
      openSettings={() => {
        void browser.runtime.openOptionsPage();
      }}
    />
  </StrictMode>,
);
