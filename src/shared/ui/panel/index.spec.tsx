import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Panel } from "./index";

describe("Panel", () => {
  it("renders its children", () => {
    render(
      <Panel>
        <span>contents</span>
      </Panel>,
    );

    expect(screen.getByText("contents")).toBeInTheDocument();
  });

  it("carries a light appearance and a dark counterpart for every colour", () => {
    render(<Panel>contents</Panel>);

    const panel = screen.getByTestId("popup-panel");

    expect(panel).toHaveClass("bg-white", "text-slate-900");
    expect(panel).toHaveClass("dark:bg-slate-900", "dark:text-slate-100");
  });
});
