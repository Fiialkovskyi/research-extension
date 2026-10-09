import type { InstalledModelSummary } from "../../types";
import { getReadableSize } from "./utils/getReadableSize";

export interface ModelListProps {
  models: readonly InstalledModelSummary[];
}

/** How each conformance outcome reads to a person, and how it is coloured. */
const CONFORMANCE_LABELS = {
  pending: { text: "Not yet checked", className: "text-amber-700 dark:text-amber-400" },
  passed: { text: "Passed its checks", className: "text-emerald-700 dark:text-emerald-400" },
  failed: { text: "Failed its checks", className: "text-red-700 dark:text-red-400" },
} as const;

/**
 * Shows what is installed: what it is pinned to, what it cost, and whether it
 * may be used.
 *
 * The pinned revision is shown, abbreviated, because it is the thing that makes
 * a model's output reproducible — two installs of the same repository at
 * different commits are different models, and nothing else on screen would
 * distinguish them.
 *
 * Colour is never the only carrier of state: each outcome is also named.
 */
export function ModelList({ models }: ModelListProps) {
  if (models.length === 0) {
    return (
      <p data-testid="model-list-empty" className="text-sm text-slate-600 dark:text-slate-400">
        No model is installed yet. Installing one is what makes semantic features available.
      </p>
    );
  }

  return (
    <ul data-testid="model-list" className="flex flex-col gap-3">
      {models.map((model) => {
        const conformance = CONFORMANCE_LABELS[model.conformance];

        return (
          <li
            key={model.ref}
            data-testid="model-list-item"
            className="rounded border border-slate-200 p-3 dark:border-slate-700"
          >
            <p className="text-sm font-medium">{model.repository}</p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-xs text-slate-600 dark:text-slate-400">
              <dt>Pinned to</dt>
              <dd>
                <code>{model.revision.slice(0, 12)}</code>
                {model.quantization === undefined ? null : ` · ${model.quantization}`}
              </dd>
              <dt>Family</dt>
              <dd>{model.family}</dd>
              <dt>Disk</dt>
              <dd>{getReadableSize(model.diskBytes)}</dd>
              <dt>Checks</dt>
              <dd className={conformance.className}>
                {conformance.text}
                {model.conformanceReason === undefined ? null : ` — ${model.conformanceReason}`}
              </dd>
              <dt>In use</dt>
              <dd>{model.active ? "Yes" : "No"}</dd>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
