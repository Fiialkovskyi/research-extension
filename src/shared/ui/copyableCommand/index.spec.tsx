import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyableCommand } from ".";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CopyableCommand", () => {
  it("shows the command as typed", () => {
    render(<CopyableCommand text="ollama serve" testId="command" />);

    expect(screen.getByTestId("command").textContent).toBe("ollama serve");
  });

  it("copies it, and says so", async () => {
    const writeText = vi.fn(() => Promise.resolve());

    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<CopyableCommand text="ollama serve" testId="command" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("ollama serve");
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy());
  });
});
