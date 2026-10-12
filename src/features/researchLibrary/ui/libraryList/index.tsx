import { ConfirmDelete } from "@/features/recordedData/ui/confirmDelete";
import { Button } from "@/shared/ui";

import type { SavedSessionSummary } from "../../types";

export interface LibraryListProps {
  sessions: readonly SavedSessionSummary[];
  onResume: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

/** "You left off at <title> (<n>% read)", the words the library and the popup share. */
export const formatLeftOff = ({ title, readFraction }: { title: string; readFraction: number }) =>
  `You left off at ${title} (${Math.round(readFraction * 100)}% read)`;

/**
 * The saved sessions, newest first (REQ-STO-004): each with when it was saved,
 * how many pages it recorded and where it was left off, to resume or delete.
 */
export function LibraryList({ sessions, onResume, onDelete }: LibraryListProps) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="library-heading" className="mt-3 text-sm">
      <h2 id="library-heading" className="font-medium">
        Saved research
      </h2>
      <ul className="mt-1 flex flex-col gap-2">
        {sessions.map((session) => (
          <li key={session.id} data-testid="saved-session" data-session-id={session.id}>
            <p className="font-medium">{session.title}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Saved {new Date(session.savedAt).toLocaleString()} ·{" "}
              {session.pageCount === 1 ? "1 page" : `${session.pageCount} pages`}
              {session.lastPosition !== null && ` · ${formatLeftOff(session.lastPosition)}`}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button
                data-testid="resume-session"
                onClick={() => {
                  onResume(session.id);
                }}
              >
                Resume
              </Button>
              <ConfirmDelete
                subject="this session"
                testId="delete-saved-session"
                onConfirm={() => {
                  onDelete(session.id);
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
