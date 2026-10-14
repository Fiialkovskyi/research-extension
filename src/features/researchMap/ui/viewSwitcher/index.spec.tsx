import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ViewSwitcher } from ".";

describe("ViewSwitcher", () => {
  it("presses the current view's button", () => {
    render(<ViewSwitcher view="anchors" onChange={() => undefined} />);

    expect(screen.getByTestId("map-view-anchors").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("map-view-tree").getAttribute("aria-pressed")).toBe("false");
  });

  it("names the key that picks each view", () => {
    render(<ViewSwitcher view="tree" onChange={() => undefined} />);

    expect(screen.getByTestId("map-view-history").getAttribute("aria-keyshortcuts")).toBe("1");
    expect(screen.getByTestId("map-view-telemetry").getAttribute("aria-keyshortcuts")).toBe("4");
  });

  it("asks for the view clicked", () => {
    const onChange = vi.fn();

    render(<ViewSwitcher view="tree" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("map-view-telemetry"));

    expect(onChange).toHaveBeenCalledWith("telemetry");
  });
});
