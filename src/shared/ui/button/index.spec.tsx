import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./index";

describe("Button", () => {
  it("renders its children and reports clicks", () => {
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Install</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("never submits a form", () => {
    render(<Button>Install</Button>);

    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("does not react to clicks while disabled", () => {
    const onClick = vi.fn();

    render(
      <Button disabled onClick={onClick}>
        Install
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
  });
});
