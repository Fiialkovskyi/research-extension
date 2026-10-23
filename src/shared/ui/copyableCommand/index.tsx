import { useState } from "react";

export interface CopyableCommandProps {
  /** The command, shown as typed. */
  text: string;
  testId: string;
}

/** A command the user pastes somewhere, with one button that copies it. */
export function CopyableCommand({ text, testId }: CopyableCommandProps) {
  const [isCopied, setIsCopied] = useState(false);

  return (
    <span className="flex items-start gap-2">
      <code
        data-testid={testId}
        className="rounded bg-slate-100 px-1 py-0.5 text-xs break-all dark:bg-slate-800"
      >
        {text}
      </code>
      <button
        type="button"
        className="shrink-0 text-xs underline"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => {
            setIsCopied(true);
          });
        }}
      >
        {isCopied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
