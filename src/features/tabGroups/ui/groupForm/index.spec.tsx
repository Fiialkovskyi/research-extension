import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GroupForm } from ".";

const type = (value: string) => {
  fireEvent.change(screen.getByLabelText("Session title"), { target: { value } });
};

describe("GroupForm", () => {
  it("cannot be submitted while the title is empty", () => {
    const onSubmit = vi.fn();
    render(<GroupForm onSubmit={onSubmit} />);

    expect(screen.getByTestId("group-submit")).toBeDisabled();

    fireEvent.submit(screen.getByTestId("group-form"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("cannot be submitted when the title is only whitespace", () => {
    const onSubmit = vi.fn();
    render(<GroupForm onSubmit={onSubmit} />);

    type("   ");

    expect(screen.getByTestId("group-submit")).toBeDisabled();
    fireEvent.submit(screen.getByTestId("group-form"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the trimmed title when the button is clicked", () => {
    const onSubmit = vi.fn();
    render(<GroupForm onSubmit={onSubmit} />);

    type("  E-bike motors  ");
    fireEvent.click(screen.getByTestId("group-submit"));

    expect(onSubmit).toHaveBeenCalledWith("E-bike motors");
  });

  it("submits on Enter, through the form", () => {
    const onSubmit = vi.fn();
    render(<GroupForm onSubmit={onSubmit} />);

    type("E-bike motors");
    fireEvent.submit(screen.getByTestId("group-form"));

    expect(onSubmit).toHaveBeenCalledWith("E-bike motors");
  });

  it("does not submit again while a request is pending", () => {
    const onSubmit = vi.fn();
    render(<GroupForm onSubmit={onSubmit} pending />);

    type("E-bike motors");

    expect(screen.getByTestId("group-submit")).toBeDisabled();
    fireEvent.submit(screen.getByTestId("group-form"));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
