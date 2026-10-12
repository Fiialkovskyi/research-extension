import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDelete } from ".";

describe("ConfirmDelete", () => {
  it("asks first, naming what will be deleted, and deletes only when confirmed", () => {
    const onConfirm = vi.fn();

    render(<ConfirmDelete subject="this page" onConfirm={onConfirm} testId="delete" />);
    fireEvent.click(screen.getByTestId("delete"));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId("delete-confirm")).toHaveTextContent(
      "Delete this page and everything derived from it",
    );

    fireEvent.click(screen.getByTestId("delete-confirm"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("deletes nothing when cancelled, and offers the control again", () => {
    const onConfirm = vi.fn();

    render(<ConfirmDelete subject="this page" onConfirm={onConfirm} testId="delete" />);
    fireEvent.click(screen.getByTestId("delete"));
    fireEvent.click(screen.getByTestId("delete-cancel"));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId("delete")).toBeInTheDocument();
  });
});
