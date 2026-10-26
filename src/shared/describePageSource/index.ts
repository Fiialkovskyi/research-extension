/**
 * Names a source by what its page said of itself: its site and the day it was
 * published, whichever it has, joined by a comma (`Bike Lab, 2026-05-01`).
 *
 * @returns The text, or an empty string when the page gave neither.
 */
export const describePageSource = ({
  siteName,
  publishedDate,
}: {
  siteName?: string | undefined;
  publishedDate?: string | undefined;
}): string => [siteName, publishedDate].filter((part) => part !== undefined).join(", ");
