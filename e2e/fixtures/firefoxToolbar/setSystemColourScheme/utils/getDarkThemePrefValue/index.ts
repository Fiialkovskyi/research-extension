/** Colour-scheme preference Firefox reports to the extension's documents. */
export type SystemColourScheme = "light" | "dark";

/**
 * Value `ui.systemUsesDarkTheme` takes for a scheme.
 *
 * Firefox reads this integer preference as an override of what the operating
 * system reports, which is what lets one session exercise both appearances.
 */
export function getDarkThemePrefValue(scheme: SystemColourScheme): number {
  return scheme === "dark" ? 1 : 0;
}
