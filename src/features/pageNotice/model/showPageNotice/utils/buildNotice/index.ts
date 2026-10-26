import { NOTICE_TITLE_MAX_LENGTH } from "../../../../constants";

export interface BuildNoticeOptions {
  document: Document;
  sessionTitle: string;
  /** The page prefers a dark colour scheme. */
  isDark: boolean;
}

/**
 * Builds the notice's content: a dot, "Added to research" and the session's
 * title. Styled through the element's own style object, not a style sheet, so a
 * page's content security policy cannot take the styling away.
 */
export const buildNotice = ({
  document,
  sessionTitle,
  isDark,
}: BuildNoticeOptions): HTMLElement => {
  const notice = document.createElement("div");
  const dot = document.createElement("span");
  const text = document.createElement("div");
  const heading = document.createElement("div");
  const title = document.createElement("div");
  const cut =
    sessionTitle.length > NOTICE_TITLE_MAX_LENGTH
      ? `${sessionTitle.slice(0, NOTICE_TITLE_MAX_LENGTH)}…`
      : sessionTitle;

  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  Object.assign(notice.style, {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    maxWidth: "280px",
    padding: "10px 14px",
    borderRadius: "8px",
    border: `1px solid ${isDark ? "#475569" : "#cbd5e1"}`,
    background: isDark ? "#1e293b" : "#ffffff",
    color: isDark ? "#f1f5f9" : "#0f172a",
    boxShadow: "0 4px 16px rgba(15, 23, 42, 0.25)",
    font: "14px/1.35 system-ui, sans-serif",
    boxSizing: "border-box",
  });
  Object.assign(dot.style, {
    flex: "none",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: isDark ? "#4ade80" : "#16a34a",
  });
  Object.assign(title.style, {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "12px",
    color: isDark ? "#cbd5e1" : "#475569",
  });
  Object.assign(text.style, { minWidth: "0" });
  heading.style.fontWeight = "600";
  heading.textContent = "Added to research";
  title.textContent = cut;
  dot.setAttribute("aria-hidden", "true");
  text.append(heading, title);
  notice.append(dot, text);

  return notice;
};
