import { useState } from "react";

import { Button } from "@/shared/ui";

export interface ConfirmDeleteProps {
  /** What the control deletes, in words: shown on the button and in the confirmation. */
  subject: string;
  onConfirm: () => void;
  /** Distinguishes the control in tests and the e2e harness. */
  testId: string;
}

/**
 * A delete control that never deletes on its first press (REQ-UI-003): it asks
 * first, naming what will go, and deletes only when that is confirmed.
 * Inline rather than a browser dialog, which would block the page.
 */
export function ConfirmDelete({ subject, onConfirm, testId }: ConfirmDeleteProps) {
  const [isAsking, setIsAsking] = useState(false);

  if (!isAsking) {
    return (
      <Button
        data-testid={testId}
        onClick={() => {
          setIsAsking(true);
        }}
      >
        Delete {subject}
      </Button>
    );
  }

  return (
    <span role="group" aria-label={`Confirm deleting ${subject}`} className="inline-flex gap-2">
      <Button
        data-testid={`${testId}-confirm`}
        onClick={() => {
          setIsAsking(false);
          onConfirm();
        }}
      >
        Delete {subject} and everything derived from it
      </Button>
      <Button
        data-testid={`${testId}-cancel`}
        onClick={() => {
          setIsAsking(false);
        }}
      >
        Cancel
      </Button>
    </span>
  );
}
