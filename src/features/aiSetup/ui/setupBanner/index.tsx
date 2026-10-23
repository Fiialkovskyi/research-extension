import { Button, StatusDot } from "@/shared/ui";

export interface SetupBannerProps {
  /** Folded to one line; it never goes away while AI is not set up. */
  isCollapsed: boolean;
  /** Opens the setup page. */
  onSetUp: () => void;
  onToggle: (isCollapsed: boolean) => void;
}

/**
 * The popup's reminder that AI is not set up yet: one sentence on what does
 * not work, one action that leads to setup. It can be folded, not dismissed.
 */
export function SetupBanner({ isCollapsed, onSetUp, onToggle }: SetupBannerProps) {
  return (
    <div
      data-testid="setup-banner"
      data-collapsed={isCollapsed}
      role="region"
      aria-label="AI setup"
      className="mb-3 rounded border border-amber-300 bg-amber-50 p-2 text-sm dark:border-amber-700 dark:bg-amber-950"
    >
      <div className="flex items-center gap-2">
        <StatusDot tone="attention" />
        <span className="font-medium">AI isn&apos;t set up</span>
        <span className="ml-auto flex items-center gap-2">
          {isCollapsed && (
            <button
              type="button"
              data-testid="setup-banner-action"
              className="underline"
              onClick={onSetUp}
            >
              Set up
            </button>
          )}
          <button
            type="button"
            data-testid="setup-banner-toggle"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Show more" : "Show less"}
            className="text-xs text-slate-600 dark:text-slate-300"
            onClick={() => {
              onToggle(!isCollapsed);
            }}
          >
            {isCollapsed ? "▾" : "▴"}
          </button>
        </span>
      </div>
      {!isCollapsed && (
        <>
          <p className="mt-1 text-slate-700 dark:text-slate-200">
            Similar pages and summaries don&apos;t work yet. Pages are still recorded.
          </p>
          <div className="mt-2">
            <Button data-testid="setup-banner-action" onClick={onSetUp}>
              Set up AI
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
