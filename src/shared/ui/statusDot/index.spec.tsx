import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusDot } from "./index";

describe("StatusDot", () => {
  it("colours each tone differently", () => {
    render(
      <>
        <StatusDot tone="ok" />
        <StatusDot tone="bad" />
      </>,
    );

    const [ok, bad] = screen.getAllByTestId("status-dot");

    expect(ok).toHaveClass("bg-emerald-500");
    expect(bad).toHaveClass("bg-red-500");
  });

  it("names its state for assistive technology when given a label", () => {
    render(<StatusDot tone="bad" label="Failed" />);

    expect(screen.getByRole("img", { name: "Failed" })).toHaveAttribute("data-tone", "bad");
  });

  it("stays out of the accessibility tree when the text beside it names the state", () => {
    render(<StatusDot tone="ok" />);

    expect(screen.getByTestId("status-dot")).toHaveAttribute("aria-hidden", "true");
  });
});
