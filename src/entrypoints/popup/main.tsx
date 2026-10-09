import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { PopupApp } from "@/app/popupApp";
import "@/shared/styles/tailwind.css";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Popup root element #root is missing from popup.html.");
}

createRoot(container).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>,
);
