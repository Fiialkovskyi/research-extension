import { describe, expect, it } from "vitest";

import { buildNotice } from ".";

const build = (sessionTitle: string, isDark = false) =>
  buildNotice({ document, sessionTitle, isDark });

/** The colour of the notice's dot. */
const dot = (kind: "added" | "blocked") =>
  (
    buildNotice({ document, sessionTitle: "A", isDark: false, kind })
      .firstElementChild as HTMLElement
  ).style.background;

describe("buildNotice", () => {
  it("says the page was added, and names the session", () => {
    const notice = build("E-bike motors");

    expect(notice.textContent).toContain("Added to research");
    expect(notice.textContent).toContain("E-bike motors");
  });

  it("says a site is not tracked, and names the session", () => {
    const notice = buildNotice({
      document,
      sessionTitle: "E-bike motors",
      isDark: false,
      kind: "blocked",
    });

    expect(notice.textContent).toContain("Not tracked");
    expect(notice.textContent).toContain("This site is not recorded in E-bike motors");
    expect(notice.textContent).not.toContain("Added to research");
  });

  it("draws a blocked site's dot in grey, not the added page's green", () => {
    expect(dot("blocked")).not.toBe(dot("added"));
  });

  it("is a polite live region", () => {
    const notice = build("E-bike motors");

    expect(notice.getAttribute("role")).toBe("status");
    expect(notice.getAttribute("aria-live")).toBe("polite");
  });

  it("cuts a very long title", () => {
    const notice = build("x".repeat(500));

    expect(notice.textContent).toContain("x".repeat(120));
    expect(notice.textContent).not.toContain("x".repeat(121));
  });

  it("follows the colour scheme", () => {
    expect(build("A", false).style.background).not.toBe(build("A", true).style.background);
  });

  it("carries its title as text, not markup", () => {
    const notice = build("<img src=x onerror=alert(1)>");

    expect(notice.querySelector("img")).toBeNull();
  });
});
