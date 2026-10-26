import type {
  RecordedEntity,
  RecordedPage as RecordedPageEntry,
  RecordedSession,
} from "../../types";
import { Button } from "@/shared/ui";

import { ConfirmDelete } from "../confirmDelete";

export interface RecordedPageProps {
  session: RecordedSession;
  /** Page texts read so far, by node id; `null` for a page without text. */
  texts: ReadonlyMap<string, string | null>;
  onShowText: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  /** Asks for the session's facts to be extracted now, while the user is active. */
  onExtractFacts: () => void;
  /** Extraction was asked for and is under way: pages not begun are waiting for the model. */
  isExtracting?: boolean;
  /** Undoes the merge of an entity into another. */
  onSeparateEntity: (entityId: string) => void;
}

const formatDuration = (milliseconds: number): string => {
  const seconds = Math.round(milliseconds / 1000);

  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
};

const formatTime = (epochMs: number): string => new Date(epochMs).toLocaleString();

/** Says how many facts a page gave, and how many were dropped as ungrounded. */
const describeFacts = (facts: RecordedPageEntry["facts"], isExtracting: boolean): string => {
  if (facts === null) {
    return isExtracting ? "waiting for the model…" : "not extracted";
  }

  return `${facts.kept} kept, ${facts.dropped} dropped${facts.isFinished ? "" : ", extracting…"}`;
};

/** Says what a page's product is, what it costs and whether it is in stock, each when known. */
const describeProduct = (
  product: NonNullable<RecordedPageEntry["metadata"]>["product"],
): string[] => {
  if (product === undefined) {
    return [];
  }

  const price =
    product.price === undefined
      ? undefined
      : [product.price, product.currency].filter((part) => part !== undefined).join(" ");

  return [
    product.name,
    price,
    product.availability === undefined ? undefined : `availability ${product.availability}`,
  ].filter((part): part is string => part !== undefined);
};

/** Lists what a page said about itself that was kept; the description only as kept, not its words. */
const describeMetadata = (metadata: RecordedPageEntry["metadata"]): string => {
  if (metadata === null) {
    return "none kept";
  }

  const parts = [
    metadata.title,
    metadata.siteName,
    metadata.type,
    metadata.author,
    metadata.publishedAt,
    metadata.canonicalUrl,
    ...describeProduct(metadata.product),
    metadata.hasDescription ? "description kept" : undefined,
  ].filter((part): part is string => part !== undefined);

  return parts.join(" · ");
};

/** One recorded page: what it was, what was kept about it, and its controls. */
function Entry({
  page,
  text,
  isExtracting,
  onShowText,
  onDeleteNode,
}: {
  page: RecordedPageEntry;
  text: string | null | undefined;
  isExtracting: boolean;
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
        <dt>Page details</dt>
        <dd data-testid="recorded-metadata">{describeMetadata(page.metadata)}</dd>
        <dt>Vectors</dt>
        <dd data-testid="recorded-vectors">{page.vectorCount}</dd>
        {snapshot !== null && (
          <>
            <dt>Facts</dt>
            <dd data-testid="recorded-facts">{describeFacts(page.facts, isExtracting)}</dd>
          </>
        )}
      </dl>
      <div className="mt-2 flex flex-wrap gap-2">
        {snapshot !== null && text === undefined && (
          <button
            type="button"
            data-testid="recorded-show-text"
            className="cursor-pointer text-sm underline"
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
 * The session's entities: what each is, how much it holds, and the names
 * merged into it, each of which the user can separate when the merge is wrong.
 */
function Entities({
  entities,
  onSeparateEntity,
}: {
  entities: readonly RecordedEntity[];
  onSeparateEntity: (entityId: string) => void;
}) {
  return (
    <section aria-labelledby="recorded-entities-heading" className="mt-4">
      <h2 id="recorded-entities-heading" className="font-medium">
        Entities
      </h2>
      {entities.length === 0 ? (
        <p data-testid="recorded-entities-empty" className="mt-1 text-sm">
          No entities found yet.
        </p>
      ) : (
        <ul className="mt-1 flex flex-col gap-2 text-sm">
          {entities.map((entity) => (
            <li key={entity.id} data-testid="recorded-entity" data-entity-id={entity.id}>
              <span className="font-medium">{entity.name}</span>{" "}
              <span className="text-neutral-500 dark:text-neutral-400">
                {entity.type} · {entity.factCount} facts · {entity.pageCount} pages
              </span>
              {entity.merged.length > 0 && (
                <ul className="mt-1 ml-4 flex flex-col gap-1">
                  {entity.merged.map((merged) => (
                    <li
                      key={merged.id}
                      data-testid="recorded-merged-name"
                      className="flex items-center gap-2"
                    >
                      <span>also named “{merged.name}”</span>
                      <Button
                        data-testid="recorded-separate-entity"
                        onClick={() => {
                          onSeparateEntity(merged.id);
                        }}
                      >
                        Separate
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Everything a session recorded, page by page, each with a delete control,
 * and a control deleting the whole session (REQ-SEC-008). A page's text is
 * shown only when asked for; its facts are counted, never shown. With a
 * generation model active, extraction can be asked for now rather than when
 * the user next steps away (REQ-MOD-008).
 */
export function RecordedPage({
  session,
  texts,
  onShowText,
  onDeleteNode,
  onDeleteSession,
  onExtractFacts,
  isExtracting = false,
  onSeparateEntity,
}: RecordedPageProps) {
  return (
    <section aria-labelledby="recorded-heading">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 id="recorded-heading" data-testid="recorded-title" className="text-lg font-semibold">
          What was recorded: {session.title}
        </h1>
        {session.canExtractFacts && (
          <Button
            data-testid="recorded-extract-facts"
            disabled={isExtracting}
            onClick={onExtractFacts}
          >
            {isExtracting ? "Extracting facts…" : "Extract facts now"}
          </Button>
        )}
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
              isExtracting={isExtracting}
              onShowText={onShowText}
              onDeleteNode={onDeleteNode}
            />
          ))}
        </ul>
      )}
      <Entities entities={session.entities} onSeparateEntity={onSeparateEntity} />
    </section>
  );
}
