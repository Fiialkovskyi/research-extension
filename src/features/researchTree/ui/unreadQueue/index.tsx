import type { MapNode } from "@/features/researchMap";

export interface UnreadQueueProps {
  /** Open pages never looked at, oldest first. */
  pages: readonly MapNode[];
  /** The user chose a page: select its tab. */
  onFocusTab: (tabId: number) => void;
}

/** The pages the user opened but has not looked at yet, to come back to. */
export function UnreadQueue({ pages, onFocusTab }: UnreadQueueProps) {
  return (
    <section aria-labelledby="unread-heading" className="text-sm">
      <h2 id="unread-heading" data-testid="unread-count" className="font-medium">
        {pages.length === 0 ? "Nothing unread" : `Unread: ${pages.length}`}
      </h2>
      {pages.length > 0 && (
        <ul className="mt-1 flex flex-col">
          {pages.map((page) => (
            <li key={page.id}>
              <button
                type="button"
                data-testid="unread-page"
                className="w-full truncate rounded px-1 py-0.5 text-left hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-neutral-800"
                onClick={() => {
                  onFocusTab(page.tabId);
                }}
              >
                {page.title.trim() === "" ? page.url : page.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
