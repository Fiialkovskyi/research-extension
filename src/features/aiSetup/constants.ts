/** Path of the setup page inside the package. */
export const SETUP_PAGE_PATH = "/setup.html";

/** The add-on's icon inside the package, shown on the install notification. */
export const NOTIFICATION_ICON_PATH = "/icon.svg";

/** Names the install notification, so its click is told apart from any other. */
export const SETUP_NOTIFICATION_ID = "ai-setup";

/** What the one notification after install says. Plain words: the user has not met the add-on yet. */
export const SETUP_NOTIFICATION = {
  title: "Research Graph is installed",
  message: "Set up local AI to find similar pages and summaries. It takes a few minutes.",
} as const;

/** How the toolbar badge looks for each state that has one. */
export const BADGE_APPEARANCE = {
  needsSetup: { text: "!", color: "#b45309" },
  paused: { text: "…", color: "#475569" },
} as const;
