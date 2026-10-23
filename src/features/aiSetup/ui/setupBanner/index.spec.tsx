import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SetupBanner } from ".";

afterEach(cleanup);

describe("SetupBanner", () => {
  it("says what does not work yet, with one action that leads to setup", () => {
    const onSetUp = vi.fn();

    render(<SetupBanner isCollapsed={false} onSetUp={onSetUp} onToggle={vi.fn()} />);

    expect(screen.getByTestId("setup-banner").textContent).toContain("don't work yet");
    fireEvent.click(screen.getByTestId("setup-banner-action"));
    expect(onSetUp).toHaveBeenCalledOnce();
  });

  it("folds to one line that still leads to setup", () => {
    const onSetUp = vi.fn();

    render(<SetupBanner isCollapsed onSetUp={onSetUp} onToggle={vi.fn()} />);

    expect(screen.getByTestId("setup-banner").textContent).not.toContain("don't work yet");
    fireEvent.click(screen.getByTestId("setup-banner-action"));
    expect(onSetUp).toHaveBeenCalledOnce();
  });

  it("asks to fold or unfold, and offers no way to dismiss it", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <SetupBanner isCollapsed={false} onSetUp={vi.fn()} onToggle={onToggle} />,
    );

    fireEvent.click(screen.getByTestId("setup-banner-toggle"));
    expect(onToggle).toHaveBeenLastCalledWith(true);

    rerender(<SetupBanner isCollapsed onSetUp={vi.fn()} onToggle={onToggle} />);
    fireEvent.click(screen.getByTestId("setup-banner-toggle"));
    expect(onToggle).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("button", { name: /dismiss|close/iu })).toBeNull();
  });
});
