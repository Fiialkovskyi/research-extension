import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SessionPicker, type SessionPickerProps } from ".";

const SAVED = [
  {
    id: "motors",
    title: "E-bike motors",
    savedAt: 200,
    pageCount: 2,
    lastPosition: { title: "Page B", readFraction: 0.4 },
  },
  { id: "batteries", title: "Batteries", savedAt: 100, pageCount: 1, lastPosition: null },
];

const ACTIVE = [
  { id: "chargers", title: "Chargers", pageCount: 3 },
  { id: "frames", title: "Frames", pageCount: 1 },
];

const renderPicker = (props: Partial<SessionPickerProps> = {}) => {
  const handlers = {
    onCreate: vi.fn(),
    onView: vi.fn(),
    onResume: vi.fn(),
    onDelete: vi.fn(),
  };

  render(<SessionPicker saved={SAVED} {...handlers} {...props} />);

  return handlers;
};

const choose = (value: string) => {
  fireEvent.change(screen.getByTestId("session-select"), { target: { value } });
};

describe("SessionPicker", () => {
  it("shows only the title form when there is no session at all", () => {
    renderPicker({ saved: [] });

    expect(screen.getByLabelText("Session title")).toBeInTheDocument();
    expect(screen.queryByTestId("session-select")).toBeNull();
  });

  it("chooses the newest saved session to begin with, and describes it", () => {
    renderPicker();

    expect(screen.getByTestId("session-select")).toHaveValue("motors");
    expect(screen.getByRole("option", { name: "E-bike motors · 2 pages" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Batteries · 1 page" })).toBeInTheDocument();

    const details = screen.getByTestId("saved-session");

    expect(details).toHaveTextContent("2 pages");
    expect(details).toHaveTextContent("You left off at Page B (40% read)");
    expect(screen.queryByLabelText("Session title")).toBeNull();
  });

  it("describes another session once it is chosen", () => {
    renderPicker();
    choose("batteries");

    expect(screen.getByTestId("saved-session")).toHaveTextContent("Batteries");
    expect(screen.getByTestId("saved-session")).not.toHaveTextContent("You left off");
  });

  it("opens the title form from the plus button, and closes it again on cancel", () => {
    renderPicker();
    fireEvent.click(screen.getByTestId("session-new"));

    expect(screen.getByLabelText("Session title")).toHaveFocus();
    expect(screen.queryByTestId("session-select")).toBeNull();

    fireEvent.click(screen.getByTestId("group-cancel"));

    expect(screen.getByTestId("session-select")).toBeInTheDocument();
  });

  it("starts a session with the typed title", () => {
    const { onCreate } = renderPicker();

    fireEvent.click(screen.getByTestId("session-new"));
    fireEvent.change(screen.getByLabelText("Session title"), { target: { value: " Chargers " } });
    fireEvent.click(screen.getByTestId("group-submit"));

    expect(onCreate).toHaveBeenCalledWith("Chargers");
  });

  it("resumes the chosen session", () => {
    const { onResume } = renderPicker();

    choose("batteries");
    fireEvent.click(screen.getByTestId("resume-session"));

    expect(onResume).toHaveBeenCalledWith("batteries");
  });

  it("shows delete beside resume, and deletes only once confirmed", () => {
    const { onDelete } = renderPicker();

    fireEvent.click(screen.getByTestId("delete-saved-session"));

    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("delete-saved-session-confirm"));

    expect(onDelete).toHaveBeenCalledWith("motors");
  });

  it("falls back to the newest session when the chosen one is gone", () => {
    const props = { onCreate: () => {}, onView: () => {}, onResume: () => {}, onDelete: () => {} };
    const { rerender } = render(<SessionPicker saved={SAVED} {...props} />);

    choose("batteries");
    rerender(<SessionPicker saved={SAVED.slice(0, 1)} {...props} />);

    expect(screen.getByTestId("session-select")).toHaveValue("motors");
  });

  describe("while sessions are being recorded", () => {
    it("lists them before the saved ones, with the viewed one chosen and nothing described", () => {
      renderPicker({ active: ACTIVE, viewedId: "frames" });

      expect(screen.getByTestId("session-select")).toHaveValue("frames");
      expect(screen.getByRole("option", { name: "Chargers · 3 pages" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Frames · 1 page" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "E-bike motors · 2 pages" })).toBeInTheDocument();
      expect(screen.queryByTestId("saved-session")).toBeNull();
    });

    it("only asks to view an active session that is chosen, closing nothing", () => {
      const { onView, onResume, onCreate } = renderPicker({ active: ACTIVE, viewedId: "frames" });

      choose("chargers");

      expect(onView).toHaveBeenCalledWith("chargers");
      expect(onResume).not.toHaveBeenCalled();
      expect(onCreate).not.toHaveBeenCalled();
    });

    it("keeps the plus enabled and offers Resume for a saved session, with no warning", () => {
      const { onResume } = renderPicker({ active: ACTIVE, viewedId: "frames" });

      expect(screen.getByTestId("session-new")).toBeEnabled();

      choose("motors");
      fireEvent.click(screen.getByTestId("resume-session"));

      expect(onResume).toHaveBeenCalledWith("motors");
      expect(screen.queryByTestId("switch-warning")).toBeNull();
      expect(screen.queryByTestId("switch-session")).toBeNull();
    });

    it("shows the sessions being recorded alone when nothing is saved", () => {
      renderPicker({ active: ACTIVE, viewedId: "chargers", saved: [] });

      expect(screen.getByTestId("session-select")).toHaveValue("chargers");
      expect(screen.getByTestId("session-new")).toBeEnabled();
    });
  });
});
