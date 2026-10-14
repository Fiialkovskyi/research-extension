import { MAP_VIEWS } from "../../constants";
import type { MapView } from "../../types";

export interface ViewSwitcherProps {
  view: MapView;
  onChange: (view: MapView) => void;
}

/** What each view is called on its button. */
const VIEW_LABELS: Record<MapView, string> = {
  history: "Simple history",
  tree: "Tree",
  anchors: "Anchors",
  telemetry: "Telemetry",
};

/**
 * The map's views as one row of buttons, the current one pressed. Each shows
 * the key that picks it, which the map listens for.
 */
export function ViewSwitcher({ view, onChange }: ViewSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Map view"
      className="inline-flex rounded-md border border-neutral-300 p-0.5 dark:border-neutral-700"
    >
      {MAP_VIEWS.map((candidate, index) => (
        <button
          key={candidate}
          type="button"
          data-testid={`map-view-${candidate}`}
          aria-pressed={candidate === view}
          aria-keyshortcuts={String(index + 1)}
          onClick={() => {
            onChange(candidate);
          }}
          className="rounded px-2.5 py-1 text-xs text-neutral-600 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-blue-600 aria-pressed:bg-neutral-200 aria-pressed:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 dark:aria-pressed:bg-neutral-800 dark:aria-pressed:text-neutral-100"
        >
          {VIEW_LABELS[candidate]}
          <kbd className="ml-1.5 font-mono text-[10px] text-neutral-500">{index + 1}</kbd>
        </button>
      ))}
    </div>
  );
}
