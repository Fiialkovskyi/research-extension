import { NAV_BAR_AREA } from "../../../constants";

/**
 * Fails unless the widget ended up on the navigation toolbar.
 *
 * Firefox may park a newly installed extension in the unified-extensions
 * panel, where the button is not directly clickable, so a silent miss here
 * would surface later as an element that cannot be found.
 */
export function assertPlacedOnNavBar(area: unknown): void {
  if (area !== NAV_BAR_AREA) {
    throw new Error(`Toolbar action is not on the navigation bar (area: ${String(area)}).`);
  }
}
