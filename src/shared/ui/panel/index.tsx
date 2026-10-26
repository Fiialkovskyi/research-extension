import type { ReactNode } from "react";

export interface PanelProps {
  children: ReactNode;
}

/**
 * Shell of the toolbar popup: fixed width (416px, wide enough for every control on one row) so the dropdown has a stable size,
 * and a light/dark pair that follows the OS colour-scheme preference through
 * Tailwind's `dark:` variant (no toggle, no stored preference).
 */
export function Panel({ children }: PanelProps) {
  return (
    <div
      data-testid="popup-panel"
      className="w-[26rem] bg-white p-4 text-slate-900 dark:bg-slate-900 dark:text-slate-100"
    >
      {children}
    </div>
  );
}
