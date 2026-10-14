/** The WCAG levels every extension page is held to. */
export const AXE_RULE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

/** How long a page gets to render what it fetched from the background before it is audited. */
export const AUDIT_SETTLE_MS = 1_500;
