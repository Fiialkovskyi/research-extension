import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PopupApp } from "./index";

describe("PopupApp", () => {
  it("shows the greeting inside the popup panel", () => {
    render(<PopupApp />);

    const panel = screen.getByTestId("popup-panel");

    expect(panel).toBeInTheDocument();
    expect(panel).toContainElement(screen.getByText("Hello World"));
  });
});
