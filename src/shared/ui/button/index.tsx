import type { ComponentPropsWithoutRef } from "react";

export type ButtonProps = Omit<ComponentPropsWithoutRef<"button">, "type" | "className">;

/** The surfaces' one button style. Never submits a form, so `type` is not a prop. */
export function Button(props: ButtonProps) {
  return (
    <button
      {...props}
      type="button"
      className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-600"
    />
  );
}
