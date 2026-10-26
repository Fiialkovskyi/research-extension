import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/shared/ui";
import { TAB_GROUP_TITLE_MAX_LENGTH } from "../../constants";

export interface GroupFormProps {
  /** Called with the trimmed title; never with a blank one. */
  onSubmit: (title: string) => void;
  /** True while a request is in flight, so one title is not sent twice. */
  pending?: boolean;
  /** When given, the form offers a way out and takes the keyboard focus as it appears. */
  onCancel?: () => void;
}

/** A title input that starts a research session as a tab group. */
export function GroupForm({ onSubmit, pending = false, onCancel }: GroupFormProps) {
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const isCancellable = onCancel !== undefined;
  const trimmed = title.trim();
  const canSubmit = trimmed !== "" && !pending;

  const submit = useCallback(() => {
    if (canSubmit) {
      onSubmit(trimmed);
    }
  }, [canSubmit, onSubmit, trimmed]);

  // The shared button never submits a form, so Enter in the input is handled
  // here and the click by the button itself; both go through `submit`.
  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submit();
    },
    [submit],
  );

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value);
  }, []);

  // A form the user asked for is the thing they are about to type into.
  useEffect(() => {
    if (isCancellable) {
      input.current?.focus();
    }
  }, [isCancellable]);

  return (
    <form data-testid="group-form" className="mt-3 flex flex-col gap-2" onSubmit={handleSubmit}>
      <label htmlFor="group-title" className="text-sm">
        Session title
      </label>
      <div className="flex gap-2">
        <input
          ref={input}
          id="group-title"
          data-testid="group-title"
          className="min-w-0 flex-1 rounded border border-slate-300 bg-transparent px-2 py-1 text-sm dark:border-slate-600"
          value={title}
          maxLength={TAB_GROUP_TITLE_MAX_LENGTH}
          onChange={handleChange}
        />
        <Button data-testid="group-submit" disabled={!canSubmit} onClick={submit}>
          Start
        </Button>
        {onCancel !== undefined && (
          <Button data-testid="group-cancel" aria-label="Cancel" onClick={onCancel}>
            ✕
          </Button>
        )}
      </div>
    </form>
  );
}
