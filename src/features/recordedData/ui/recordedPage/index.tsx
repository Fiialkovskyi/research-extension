import type { RecordedPage as RecordedPageEntry, RecordedSession } from "../../types";
import { ConfirmDelete } from "../confirmDelete";

export interface RecordedPageProps {
  session: RecordedSession;
  /** Page texts read so far, by node id; `null` for a page without text. */
  texts: ReadonlyMap<string, string | null>;
  onShowText: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

const formatDuration = (milliseconds: number): string => {
  const seconds = Math.round(milliseconds / 1000);

  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
};

const formatTime = (epochMs: number): string => new Date(epochMs).toLocaleString();

/** One recorded page: what it was, what was kept about it, and its controls. */
function Entry({
  page,
  text,
  onShowText,
  onDeleteNode,
}: {
  page: RecordedPageEntry;
  text: string | null | undefined;
  onShowText: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
}) {
  const { signals, snapshot } = page;

  return (
    <li
      data-testid="recorded-entry"
      data-node-id={page.id}
      className="border-b border-neutral-200 py-3 dark:border-neutral-800"
    >
      <h2 className="font-medium">{page.title.trim() === "" ? page.url : page.title}</h2>
      <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{page.url}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
        <dt>Recorded</dt>
        <dd>{formatTime(page.createdAt)}</dd>
        <dt>Reading time</dt>
        <dd data-testid="recorded-dwell">{formatDuration(signals.activeDwellMs)}</dd>
        <dt>Scrolled</dt>
        <dd data-testid="recorded-scroll">{Math.round(signals.maxScroll * 100)}%</dd>
        <dt>Copies</dt>
        <dd data-testid="recorded-copies">{signals.copyEvents}</dd>
        <dt>Selected</dt>
        <dd>{signals.focusCount} times</dd>
        <dt>Revisits</dt>
        <dd>{signals.revisitCount}</dd>
        <dt>Quick returns to search</dt>
        <dd>{signals.quickReturnCount}</dd>
        <dt>Page text</dt>
        <dd data-testid="recorded-snapshot">
          {snapshot === null
            ? "none kept"
            : `${(snapshot.byteLength / 1024).toFixed(1)} KB${snapshot.truncated ? ", truncated" : ""}, kept ${formatTime(snapshot.capturedAt)}`}
        </dd>
        <dt>Vectors</dt>
        <dd data-testid="recorded-vectors">{page.vectorCount}</dd>
      </dl>
      <div className="mt-2 flex flex-wrap gap-2">
        {snapshot !== null && text === undefined && (
          <button
            type="button"
            data-testid="recorded-show-text"
            className="text-sm underline"
            onClick={() => {
              onShowText(page.id);
            }}
          >
            Show the kept text
          </button>
        )}
        <ConfirmDelete
          subject="this page"
          testId="recorded-delete-page"
          onConfirm={() => {
            onDeleteNode(page.id);
          }}
        />
      </div>
      {typeof text === "string" && (
        <pre
          data-testid="recorded-text"
          className="mt-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap"
        >
          {text}
        </pre>
      )}
    </li>
  );
}

/**
 * Everything a session recorded, page by page, each with a delete control,
 * and a control deleting the whole session (REQ-SEC-008). A page's text is
 * shown only when asked for.
 */
export function RecordedPage({
  session,
  texts,
  onShowText,
  onDeleteNode,
  onDeleteSession,
}: RecordedPageProps) {
  return (
    <section aria-labelledby="recorded-heading">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 id="recorded-heading" data-testid="recorded-title" className="text-lg font-semibold">
          What was recorded: {session.title}
        </h1>
        <ConfirmDelete
          subject="this session"
          testId="recorded-delete-session"
          onConfirm={() => {
            onDeleteSession(session.id);
          }}
        />
      </header>
      {session.pages.length === 0 ? (
        <p className="mt-3 text-sm">No pages recorded yet.</p>
      ) : (
        <ul className="mt-2">
          {session.pages.map((page) => (
            <Entry
              key={page.id}
              page={page}
              text={texts.get(page.id)}
              onShowText={onShowText}
              onDeleteNode={onDeleteNode}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
