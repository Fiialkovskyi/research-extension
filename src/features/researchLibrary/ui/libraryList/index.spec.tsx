import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { formatLeftOff, LibraryList } from ".";

const SESSIONS = [
  {
    id: "motors",
    title: "E-bike motors",
    savedAt: 200,
    pageCount: 2,
    lastPosition: { title: "Page B", readFraction: 0.4 },
  },
  { id: "batteries", title: "Batteries", savedAt: 100, pageCount: 1, lastPosition: null },
];

describe("LibraryList", () => {
  it("lists each saved session with its pages and where it was left off", () => {
    render(<LibraryList sessions={SESSIONS} onResume={() => {}} onDelete={() => {}} />);

    const [motors, batteries] = screen.getAllByTestId("saved-session");

    expect(motors).toHaveTextContent("E-bike motors");
    expect(motors).toHaveTextContent("2 pages");
    expect(motors).toHaveTextContent("You left off at Page B (40% read)");
    expect(batteries).toHaveTextContent("1 page");
  });

  it("resumes a session, and deletes one only once confirmed", () => {
    const onResume = vi.fn();
    const onDelete = vi.fn();

    render(<LibraryList sessions={SESSIONS.slice(0, 1)} onResume={onResume} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId("resume-session"));
    fireEvent.click(screen.getByTestId("delete-saved-session"));

    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("delete-saved-session-confirm"));

    expect(onResume).toHaveBeenCalledWith("motors");
    expect(onDelete).toHaveBeenCalledWith("motors");
  });

  it("shows nothing when nothing is saved", () => {
    const { container } = render(
      <LibraryList sessions={[]} onResume={() => {}} onDelete={() => {}} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("words where the user left off", () => {
    expect(formatLeftOff({ title: "Page B", readFraction: 0.456 })).toBe(
      "You left off at Page B (46% read)",
    );
  });
});
