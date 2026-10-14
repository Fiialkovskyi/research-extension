import { DEFAULT_MAP_VIEW, MAP_VIEWS } from "../../constants";
import type { MapView } from "../../types";

/**
 * Reads the view a map page's address names, as `#telemetry`, so a reload or
 * a shared link opens the same view. Anything else opens the default.
 */
export const parseMapView = (hash: string): MapView => {
  const named = hash.replace(/^#/, "");

  return MAP_VIEWS.find((view) => view === named) ?? DEFAULT_MAP_VIEW;
};
