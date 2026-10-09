/** Colour-scheme preference Firefox reports to the extension's documents. */
export type SystemColorScheme = "light" | "dark";

/**
 * Value `ui.systemUsesDarkTheme` takes for a scheme.
 *
 * Firefox reads this integer preference as an override of what the operating
 * system reports, which is what lets one session exercise both appearances.
 */
export const getDarkThemePrefValue = (scheme: SystemColorScheme): number => {
  return scheme === "dark" ? 1 : 0;
};
