/** What a dot says: fine, broken, needs attention, in progress, or not yet relevant. */
export type StatusTone = "ok" | "bad" | "attention" | "busy" | "idle";

export interface StatusDotProps {
  tone: StatusTone;
  /**
   * Says the same as the colour, for whoever cannot see it. Leave it out only
   * when the text beside the dot already names the state.
   */
  label?: string;
}

const TONE_CLASSES: Record<StatusTone, string> = {
  ok: "bg-emerald-500",
  bad: "bg-red-500",
  attention: "bg-amber-400",
  busy: "bg-sky-500 animate-pulse",
  idle: "bg-slate-300 dark:bg-slate-600",
};

/** A small coloured circle that marks a line's state at a glance. */
export function StatusDot({ tone, label }: StatusDotProps) {
  return (
    <span
      data-testid="status-dot"
      data-tone={tone}
      role={label === undefined ? undefined : "img"}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      className={`inline-block size-2.5 shrink-0 rounded-full ${TONE_CLASSES[tone]}`}
    />
  );
}
