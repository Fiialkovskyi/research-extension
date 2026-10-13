import { StatusDot } from "@/shared/ui";

import type { BlockedRequestReport } from "../../types";

export interface PolicyReportProps {
  permittedOrigins?: readonly string[];
  blocked?: readonly BlockedRequestReport[];
}

/**
 * Shows what the network policy permits and what it has refused.
 *
 * An empty refusal list is a result, not an absence, so it is stated rather
 * than rendered as nothing: during this change it is the evidence that the
 * declared allowlist actually covers every host a model download reaches.
 */
export function PolicyReport({ permittedOrigins, blocked }: PolicyReportProps) {
  if (permittedOrigins === undefined) {
    return null;
  }

  return (
    <div data-testid="policy-report" className="text-xs text-slate-600 dark:text-slate-400">
      <p>
        Permitted: <code>{permittedOrigins.join(" ")}</code>
      </p>
      {blocked === undefined || blocked.length === 0 ? (
        <p data-testid="policy-nothing-blocked" className="mt-1 flex items-center gap-2">
          <StatusDot tone="ok" />
          Nothing has been blocked by the policy.
        </p>
      ) : (
        <ul data-testid="policy-blocked" className="mt-1 flex flex-col gap-1">
          {blocked.map((entry) => (
            <li
              key={`${entry.directive} ${entry.origin}`}
              className="flex items-center gap-2 text-red-700 dark:text-red-400"
            >
              <StatusDot tone="bad" />
              <span>
                <code>{entry.origin}</code> refused by <code>{entry.directive}</code>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
