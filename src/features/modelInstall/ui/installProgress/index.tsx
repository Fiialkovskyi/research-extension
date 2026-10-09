import type { InstallProgress as Progress } from "../../model/downloadModelFiles";
import { getPercentComplete } from "./utils/getPercentComplete";

/** Where an install has got to, from the surface's point of view. */
export type InstallState =
  | { status: "idle" }
  | { status: "running"; progress: Progress }
  | { status: "installed"; ref: string; diskBytes: number }
  | { status: "failed"; repository: string; reason: string };

export interface InstallProgressProps {
  state: InstallState;
}

/**
 * Reports an install honestly, including when it fails.
 *
 * A failure shows its reason rather than a generic message: the reasons here
 * are actionable and distinct — a digest mismatch, a gated repository, a
 * refused request — and collapsing them into "install failed" would throw away
 * the only information that tells a user what to do next.
 *
 * Progress names the file in flight as well as the percentage, because a model
 * is a handful of files of wildly different sizes and a bare percentage looks
 * stalled while the largest one transfers.
 */
export function InstallProgress({ state }: InstallProgressProps) {
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "running") {
    const percent = getPercentComplete(state.progress);

    return (
      <p data-testid="install-running" className="text-sm text-slate-700 dark:text-slate-300">
        Installing — {percent}% of {state.progress.totalFiles} files
        {state.progress.path === "" ? null : (
          <>
            {" · "}
            <code>{state.progress.path}</code>
          </>
        )}
      </p>
    );
  }

  if (state.status === "installed") {
    return (
      <p data-testid="install-installed" className="text-sm text-emerald-700 dark:text-emerald-400">
        Installed. It still has to pass its checks before anything can use it.
      </p>
    );
  }

  return (
    <p data-testid="install-failed" className="text-sm text-red-700 dark:text-red-400">
      Could not install {state.repository}: {state.reason}
    </p>
  );
}
