import { type ChangeEvent, useCallback, useState } from "react";

import { ConfirmDelete } from "@/features/recordedData/ui/confirmDelete";
import { GroupForm } from "@/features/tabGroups/ui/groupForm";
import { Button } from "@/shared/ui";

import type { SavedSessionSummary } from "../../types";
import { formatLeftOff } from "../formatLeftOff";

/** A session that is being recorded, as the select lists it. */
export interface ActiveSessionOption {
  id: string;
  title: string;
  pageCount: number;
}

export interface SessionPickerProps {
  /** The sessions being recorded, in the order they were started. */
  active?: readonly ActiveSessionOption[];
  /** The active session the popup refers to; chosen in the select. */
  viewedId?: string;
  /** The saved sessions, newest first. */
  saved: readonly SavedSessionSummary[];
  /** True while a request is in flight, so one is not sent twice. */
  pending?: boolean;
  onCreate: (title: string) => void;
  /** Chooses which active session the popup refers to; nothing else changes. */
  onView: (sessionId: string) => void;
  onResume: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

const pagesLabel = (count: number) => (count === 1 ? "1 page" : `${count} pages`);

const SELECT_ID = "session-select";

const SELECT_CLASS =
  "min-w-0 flex-1 rounded border border-slate-300 bg-transparent px-2 py-1 text-sm dark:border-slate-600";

/**
 * The top of the popup: a select over every session, and a "+" that turns the
 * row into a title field for a new one.
 *
 * The sessions being recorded come first and choosing one only changes which
 * the popup refers to — nothing is closed, switched or started. The saved
 * sessions follow; choosing one shows its card, with Resume and Delete side by
 * side, and resuming it adds it to the sessions being recorded. With no
 * session at all there is nothing to choose, so only the title form shows.
 */
export function SessionPicker({
  active = [],
  viewedId,
  saved,
  pending = false,
  onCreate,
  onView,
  onResume,
  onDelete,
}: SessionPickerProps) {
  const [savedId, setSavedId] = useState<string | undefined>();
  const [isCreating, setIsCreating] = useState(false);
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const { value } = event.target;

      if (active.some(({ id }) => id === value)) {
        setSavedId(undefined);
        onView(value);
      } else {
        setSavedId(value);
      }
    },
    [active, onView],
  );
  const startNew = useCallback(() => {
    setIsCreating(true);
  }, []);
  const cancelNew = useCallback(() => {
    setIsCreating(false);
  }, []);

  if (active.length === 0 && saved.length === 0) {
    return <GroupForm pending={pending} onSubmit={onCreate} />;
  }

  if (isCreating) {
    return <GroupForm pending={pending} onSubmit={onCreate} onCancel={cancelNew} />;
  }

  // The chosen saved session may be gone (deleted); the viewed one stands in.
  const chosenSaved = saved.find(({ id }) => id === savedId);
  const viewed = active.find(({ id }) => id === viewedId) ?? active[0];
  const selected = chosenSaved ?? (viewed === undefined ? saved[0] : undefined);
  const value = chosenSaved?.id ?? viewed?.id ?? saved[0]?.id;

  return (
    <div>
      <label htmlFor={SELECT_ID} className="mb-1 block text-sm">
        Session
      </label>
      <div className="flex gap-2">
        <select
          id={SELECT_ID}
          data-testid="session-select"
          className={SELECT_CLASS}
          {...(value === undefined ? {} : { value })}
          onChange={handleChange}
        >
          {active.length > 0 && (
            <optgroup label="Recording">
              {active.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} · {pagesLabel(session.pageCount)}
                </option>
              ))}
            </optgroup>
          )}
          {saved.length > 0 && (
            <optgroup label="Saved">
              {saved.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} · {pagesLabel(session.pageCount)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <Button data-testid="session-new" aria-label="New session" onClick={startNew}>
          ＋
        </Button>
      </div>
      {selected !== undefined && (
        <div data-testid="saved-session" data-session-id={selected.id} className="mt-3 text-sm">
          <p className="font-medium">{selected.title}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Saved {new Date(selected.savedAt).toLocaleString()} · {pagesLabel(selected.pageCount)}
            {selected.lastPosition !== null && ` · ${formatLeftOff(selected.lastPosition)}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              data-testid="resume-session"
              disabled={pending}
              onClick={() => {
                onResume(selected.id);
              }}
            >
              Resume
            </Button>
            <ConfirmDelete
              subject="session"
              testId="delete-saved-session"
              onConfirm={() => {
                onDelete(selected.id);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
